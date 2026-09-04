import React from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import RenderHTML from "react-native-render-html";

import { FONTS } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";

export type ArtworkDescriptionHtmlProps = {
  html: string;
};

export function ArtworkDescriptionHtml({ html }: ArtworkDescriptionHtmlProps) {
  const { width } = useWindowDimensions();
  const { colors } = useAppTheme();

  return (
    <View style={styles.artworkHtmlWrapper}>
      <RenderHTML
        contentWidth={width - 48}
        source={{ html }}
        baseStyle={{
          ...styles.htmlBase,
          color: colors.textSecondary,
        }}
        tagsStyles={{
          p: { ...styles.htmlParagraph, color: colors.textSecondary },
          li: { ...styles.htmlListItem, color: colors.textSecondary },
          strong: { ...styles.htmlStrong, color: colors.text },
          h1: { ...styles.htmlHeading, color: colors.text },
          h2: { ...styles.htmlHeading, color: colors.text },
          h3: { ...styles.htmlHeading, color: colors.text },
          h5: { ...styles.htmlHeading, color: colors.text },
          h6: { ...styles.htmlHeading, color: colors.text },
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  artworkHtmlWrapper: {
    marginHorizontal: 24,
    marginTop: 1,
  },
  htmlBase: {
    fontSize: 15,
    fontFamily: FONTS.sansRegular,
    lineHeight: 25,
    textAlign: "left",
  },
  htmlParagraph: {
    marginTop: 17,
    marginBottom: 5,
    fontSize: 15,
    fontFamily: FONTS.sansRegular,
    lineHeight: 25,
    textAlign: "left",
  },
  htmlListItem: {
    fontSize: 15,
    fontFamily: FONTS.sansRegular,
    lineHeight: 25,
    marginBottom: 7,
  },
  htmlStrong: {
    fontFamily: FONTS.sansBold,
  },
  htmlHeading: {
    fontFamily: FONTS.serifBold,
    marginTop: 24,
    marginBottom: 8,
    lineHeight: 28,
  },
});
