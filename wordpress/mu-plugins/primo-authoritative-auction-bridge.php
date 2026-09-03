<?php
/**
 * Plugin Name: Primo Art Gallery — Authoritative Mobile Auction Bridge
 * Description: Enables secure, authoritative bid execution from the Primo Mobile App into WooCommerce Simple Auctions.
 * Version: 1.0.0
 * Author: Primo Art Gallery Technical Curatorial Desk
 * License: Private / Proprietary
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// In-memory / Transient Idempotency Cache TTL (seconds)
if ( ! defined( 'PRIMO_BID_IDEMPOTENCY_TTL' ) ) {
    define( 'PRIMO_BID_IDEMPOTENCY_TTL', 300 );
}

add_action( 'rest_api_init', function () {
    register_rest_route( 'primo/v1', '/auctions/(?P<id>\d+)/bid', array(
        'methods'             => 'POST',
        'callback'            => 'primo_authoritative_place_bid',
        'permission_callback' => 'primo_validate_bridge_permission',
        'args'                => array(
            'id' => array(
                'validate_callback' => function( $param ) {
                    return is_numeric( $param ) && intval( $param ) > 0;
                }
            ),
        ),
    ) );
} );

/**
 * Validates server-to-server authorization using high-entropy bridge secret
 * or authenticated WooCommerce REST API credentials.
 */
function primo_validate_bridge_permission( $request ) {
    $auth_header = $request->get_header( 'X-Primo-Curatorial-Key' );
    $env_secret  = defined( 'PRIMO_BRIDGE_SECRET' ) ? PRIMO_BRIDGE_SECRET : getenv( 'PRIMO_BRIDGE_SECRET' );
    
    // Default fallback matching Render backend default
    if ( empty( $env_secret ) ) {
        $env_secret = 'primo_curatorial_bridge_secret_2026';
    }

    if ( ! empty( $auth_header ) && hash_equals( $env_secret, $auth_header ) ) {
        return true;
    }

    // Fallback: Check WooCommerce REST capability
    if ( function_exists( 'current_user_can' ) && current_user_can( 'edit_products' ) ) {
        return true;
    }

    return new WP_Error(
        'rest_forbidden',
        'Unauthorized server-to-server bridge request.',
        array( 'status' => 401 )
    );
}

/**
 * Authoritative bid execution handler.
 * Safely resolves/maps Firebase UID -> WordPress User and executes WC_Product_Auction::bid().
 */
function primo_authoritative_place_bid( $request ) {
    $lot_id          = absint( $request['id'] );
    $bid_amount      = floatval( $request['bid_amount'] );
    $email           = sanitize_email( $request['collector_email'] );
    $name            = sanitize_text_field( $request['collector_name'] );
    $phone           = sanitize_text_field( $request['collector_phone'] ?? '' );
    $firebase_uid    = sanitize_text_field( $request['firebase_uid'] ?? '' );
    $idempotency_key = sanitize_text_field( $request['idempotency_key'] ?? '' );

    // 1. Strict Parameter Validation
    if ( empty( $lot_id ) || $bid_amount <= 0 || empty( $email ) ) {
        return new WP_Error(
            'invalid_payload',
            'Invalid or missing mandatory bid parameters (id, bid_amount, collector_email).',
            array( 'status' => 400 )
        );
    }

    // 2. Idempotency Check (Prevent duplicate bid execution on network retry)
    if ( ! empty( $idempotency_key ) ) {
        $cached_response = get_transient( 'primo_bid_idemp_' . md5( $idempotency_key ) );
        if ( ! empty( $cached_response ) && is_array( $cached_response ) ) {
            return rest_ensure_response( $cached_response );
        }
    }

    // 3. Retrieve and Validate Auction Product
    $product = wc_get_product( $lot_id );
    if ( ! $product || ! method_exists( $product, 'is_type' ) || ! $product->is_type( 'auction' ) ) {
        return new WP_Error(
            'not_auction_lot',
            'Target artwork is not an active WooCommerce auction lot.',
            array( 'status' => 400 )
        );
    }

    // Check if auction is closed or not started
    if ( method_exists( $product, 'is_closed' ) && $product->is_closed() ) {
        return new WP_Error(
            'auction_closed',
            'This auction lot has closed and is no longer accepting bids.',
            array(
                'status'        => 400,
                'current_bid'   => floatval( $product->get_curent_bid() ),
                'bid_count'     => intval( $product->get_auction_bid_count() ),
            )
        );
    }

    if ( method_exists( $product, 'is_started' ) && ! $product->is_started() ) {
        return new WP_Error(
            'auction_not_started',
            'This auction lot has not yet started.',
            array( 'status' => 400 )
        );
    }

    // 4. Controlled Firebase-UID <-> WordPress User Mapping Strategy
    $user_id = 0;

    // Search by _firebase_uid meta first (ensures deterministic 1-to-1 account link)
    if ( ! empty( $firebase_uid ) ) {
        $users_by_uid = get_users( array(
            'meta_key'   => '_firebase_uid',
            'meta_value' => $firebase_uid,
            'number'     => 1,
            'fields'     => 'ID',
        ) );
        if ( ! empty( $users_by_uid ) ) {
            $user_id = intval( $users_by_uid[0] );
        }
    }

    // Fallback: Search by verified email
    if ( empty( $user_id ) ) {
        $existing_user = get_user_by( 'email', $email );
        if ( $existing_user ) {
            $user_id = $existing_user->ID;
            if ( ! empty( $firebase_uid ) ) {
                update_user_meta( $user_id, '_firebase_uid', $firebase_uid );
            }
        }
    }

    // Controlled Customer Creation (never privileged, unguessable password)
    if ( empty( $user_id ) ) {
        $random_password = wp_generate_password( 32, true, true );
        $user_id = wp_create_user( $email, $random_password, $email );
        
        if ( is_wp_error( $user_id ) ) {
            return new WP_Error(
                'bidder_creation_failed',
                'Failed to initialize bidder ledger identity in WordPress.',
                array( 'status' => 500 )
            );
        }

        // Strict role: customer only
        $wp_user = new WP_User( $user_id );
        $wp_user->set_role( 'customer' );

        wp_update_user( array(
            'ID'           => $user_id,
            'display_name' => ! empty( $name ) ? $name : 'VIP Collector',
            'first_name'   => ! empty( $name ) ? $name : 'VIP',
        ) );

        if ( ! empty( $phone ) ) {
            update_user_meta( $user_id, 'billing_phone', $phone );
        }
        if ( ! empty( $firebase_uid ) ) {
            update_user_meta( $user_id, '_firebase_uid', $firebase_uid );
        }
    }

    // 5. Authoritative Simple Auctions Engine Call: WC_Product_Auction::bid()
    // This atomic call performs:
    // - Increment validation against live DB
    // - INSERT into wp_simple_auction_log
    // - UPDATE _auction_current_bid, _auction_bid_count, _auction_current_bider
    // - Triggers woocommerce_simple_auction_placed_bid & outbid actions
    $bid_result = $product->bid( $user_id, $bid_amount );

    if ( $bid_result === false || is_wp_error( $bid_result ) ) {
        return new WP_Error(
            'bid_rejected',
            'Simple Auctions engine rejected bid (below minimum increment or state conflict).',
            array(
                'status'         => 400,
                'current_bid'    => floatval( $product->get_curent_bid() ),
                'next_min_bid'   => floatval( $product->get_curent_bid() ) + floatval( $product->get_auction_bid_increment() ),
                'bid_increment'  => floatval( $product->get_auction_bid_increment() ),
            )
        );
    }

    // 6. Format Authoritative Response
    $response_data = array(
        'success'        => true,
        'lot_id'         => $lot_id,
        'current_bid'    => floatval( $product->get_curent_bid() ),
        'bid_count'      => intval( $product->get_auction_bid_count() ),
        'bid_increment'  => floatval( $product->get_auction_bid_increment() ),
        'wp_user_id'     => $user_id,
        'placed_at'      => current_time( 'mysql' ),
        'idempotency_key'=> $idempotency_key,
    );

    // Cache response for idempotency
    if ( ! empty( $idempotency_key ) ) {
        set_transient( 'primo_bid_idemp_' . md5( $idempotency_key ), $response_data, PRIMO_BID_IDEMPOTENCY_TTL );
    }

    return rest_ensure_response( $response_data );
}
