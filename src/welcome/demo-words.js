/*
 * The welcome page's four demo words. IPA and syllables are copied from the
 * dataset. Their clips are in audio/ (same voice as the live API), so trying the
 * demo makes no API calls. The notes are hand-written for this page only and
 * follow the guide editorial rules: nothing here calls an accepted variant
 * wrong. Checked against Merriam-Webster, Dictionary.com and Wiktionary on
 * 2026-11-06.
 */
(function () {
  var QP = (self.QP = self.QP || {});

  function syl(text, stress) {
    return { text: text, stress: stress };
  }

  QP.demoWords = {
    colonel: {
      word: "colonel",
      ipa: { us: "/ˈkɝ.nl/", uk: "/ˈkɜː.nl/" },
      syllables: { us: [syl("kurnl", 1)], uk: [syl("kurnl", 1)] },
      note: "Yes, it sounds like \"kernel.\" The r comes from an older French form, coronel; the spelling later went back to the Italian colonnello."
    },
    quinoa: {
      word: "quinoa",
      ipa: { us: "/ˈkin.wɑ/", uk: "/ˈkiːn.wɑː/" },
      syllables: { us: [syl("keen", 1), syl("wah", 0)], uk: [syl("keen", 1), syl("wah", 0)] },
      note: "The word came into English from Quechua through Spanish. Some speakers also say kee-NOH-uh."
    },
    epitome: {
      word: "epitome",
      ipa: { us: "/əˈpɪt.ə.mi/", uk: "/əˈpɪt.ə.mi/" },
      syllables: {
        us: [syl("uh", 0), syl("pih", 1), syl("tuh", 0), syl("mee", 0)],
        uk: [syl("uh", 0), syl("pih", 1), syl("tuh", 0), syl("mee", 0)]
      },
      note: "Four syllables. The final e is sounded, as it was in the Greek word it comes from."
    },
    segue: {
      word: "segue",
      ipa: { us: "/ˈsɛɡweɪ/", uk: "/ˈsɛɡweɪ/" },
      syllables: { us: [syl("seh", 1), syl("gway", 0)], uk: [syl("seh", 1), syl("gway", 0)] },
      note: "Italian for \"it follows,\" first used to tell musicians to go straight into the next section."
    }
  };
})();
