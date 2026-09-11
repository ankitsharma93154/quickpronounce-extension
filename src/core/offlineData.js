/*
 * A small curated cache of commonly-mispronounced words, bundled with the
 * extension so a lookup still returns something useful when the network is
 * down. This is a FALLBACK, not the product: it is only consulted after a
 * network/timeout failure, and results are labelled "offline copy" in the UI.
 *
 * Kept deliberately short and limited to words with well-established
 * pronunciations. To grow this into a real offline pack later, replace this
 * object (or swap offlineCache.js to load a downloaded file) - callers do not
 * change.
 *
 * Shape per entry: { ipa:{us,uk}, syllables:{us,uk:[{text,stress}]},
 *                    definition, partOfSpeech }
 * stress: 1 primary, 2 secondary, 0 unstressed.
 */
(function () {
  var QP = (self.QP = self.QP || {});

  function s(text, stress) {
    return { text: text, stress: stress };
  }

  QP.offlineData = {
    pronunciation: {
      ipa: { us: "/prəˌnʌnsiˈeɪʃən/", uk: "/prəˌnʌnsɪˈeɪʃn/" },
      syllables: {
        us: [s("pruh", 0), s("nun", 2), s("see", 0), s("ay", 1), s("shuhn", 0)],
        uk: [s("pruh", 0), s("nun", 2), s("see", 0), s("ay", 1), s("shuhn", 0)]
      },
      definition: "The way in which a word is spoken.",
      partOfSpeech: "Noun"
    },
    schedule: {
      ipa: { us: "/ˈskɛdʒuːl/", uk: "/ˈʃɛdjuːl/" },
      syllables: { us: [s("skej", 1), s("ool", 0)], uk: [s("shed", 1), s("yool", 0)] },
      definition: "A plan of things to be done and the times they are to happen.",
      partOfSpeech: "Noun"
    },
    colonel: {
      ipa: { us: "/ˈkɜːrnəl/", uk: "/ˈkɜːnəl/" },
      syllables: { us: [s("kur", 1), s("nuhl", 0)], uk: [s("kur", 1), s("nuhl", 0)] },
      definition: "A senior military officer ranking below a brigadier general.",
      partOfSpeech: "Noun"
    },
    espresso: {
      ipa: { us: "/ɛˈsprɛsoʊ/", uk: "/ɛˈsprɛsəʊ/" },
      syllables: { us: [s("es", 0), s("pres", 1), s("oh", 0)], uk: [s("es", 0), s("pres", 1), s("oh", 0)] },
      definition: "Strong black coffee made by forcing steam through ground coffee beans.",
      partOfSpeech: "Noun"
    },
    quinoa: {
      ipa: { us: "/ˈkiːnwɑː/", uk: "/ˈkiːnwɑː/" },
      syllables: { us: [s("keen", 1), s("wah", 0)], uk: [s("keen", 1), s("wah", 0)] },
      definition: "A grain crop grown for its edible starchy seeds.",
      partOfSpeech: "Noun"
    },
    worcestershire: {
      ipa: { us: "/ˈwʊstərʃər/", uk: "/ˈwʊstəʃə/" },
      syllables: {
        us: [s("wuus", 1), s("tuhr", 0), s("shuhr", 0)],
        uk: [s("wuus", 1), s("tuh", 0), s("shuh", 0)]
      },
      definition: "A fermented liquid condiment; also an English county.",
      partOfSpeech: "Noun"
    },
    niche: {
      ipa: { us: "/niːʃ/", uk: "/niːʃ/" },
      syllables: { us: [s("neesh", 1)], uk: [s("neesh", 1)] },
      definition: "A comfortable or suitable position in life or employment.",
      partOfSpeech: "Noun"
    },
    thorough: {
      ipa: { us: "/ˈθɜːroʊ/", uk: "/ˈθʌrə/" },
      syllables: { us: [s("thur", 1), s("oh", 0)], uk: [s("thu", 1), s("ruh", 0)] },
      definition: "Complete with regard to every detail.",
      partOfSpeech: "Adjective"
    },
    comfortable: {
      ipa: { us: "/ˈkʌmftərbəl/", uk: "/ˈkʌmftəbəl/" },
      syllables: {
        us: [s("kumf", 1), s("tuhr", 0), s("buhl", 0)],
        uk: [s("kumf", 1), s("tuh", 0), s("buhl", 0)]
      },
      definition: "Giving a feeling of physical ease and relaxation.",
      partOfSpeech: "Adjective"
    },
    wednesday: {
      ipa: { us: "/ˈwɛnzdeɪ/", uk: "/ˈwɛnzdeɪ/" },
      syllables: { us: [s("wenz", 1), s("day", 0)], uk: [s("wenz", 1), s("day", 0)] },
      definition: "The day of the week between Tuesday and Thursday.",
      partOfSpeech: "Noun"
    },
    february: {
      ipa: { us: "/ˈfɛbruˌɛri/", uk: "/ˈfɛbruəri/" },
      syllables: {
        us: [s("feb", 1), s("roo", 0), s("er", 2), s("ee", 0)],
        uk: [s("feb", 1), s("roo", 0), s("uh", 0), s("ree", 0)]
      },
      definition: "The second month of the year.",
      partOfSpeech: "Noun"
    },
    genre: {
      ipa: { us: "/ˈʒɑːnrə/", uk: "/ˈʒɒnrə/" },
      syllables: { us: [s("zhahn", 1), s("ruh", 0)], uk: [s("zhon", 1), s("ruh", 0)] },
      definition: "A category of artistic composition marked by a shared style or subject.",
      partOfSpeech: "Noun"
    },
    entrepreneur: {
      ipa: { us: "/ˌɑːntrəprəˈnɜːr/", uk: "/ˌɒntrəprəˈnɜː/" },
      syllables: {
        us: [s("ahn", 2), s("truh", 0), s("pruh", 0), s("nur", 1)],
        uk: [s("on", 2), s("truh", 0), s("pruh", 0), s("nur", 1)]
      },
      definition: "A person who sets up a business, taking on financial risk to do so.",
      partOfSpeech: "Noun"
    },
    receipt: {
      ipa: { us: "/rɪˈsiːt/", uk: "/rɪˈsiːt/" },
      syllables: { us: [s("ruh", 0), s("seet", 1)], uk: [s("ruh", 0), s("seet", 1)] },
      definition: "A written acknowledgement that something has been received.",
      partOfSpeech: "Noun"
    },
    island: {
      ipa: { us: "/ˈaɪlənd/", uk: "/ˈaɪlənd/" },
      syllables: { us: [s("eye", 1), s("luhnd", 0)], uk: [s("eye", 1), s("luhnd", 0)] },
      definition: "A piece of land surrounded by water.",
      partOfSpeech: "Noun"
    },
    epitome: {
      ipa: { us: "/ɪˈpɪtəmi/", uk: "/ɪˈpɪtəmi/" },
      syllables: { us: [s("uh", 0), s("pit", 1), s("uh", 0), s("mee", 0)], uk: [s("uh", 0), s("pit", 1), s("uh", 0), s("mee", 0)] },
      definition: "A perfect example of a particular quality or type.",
      partOfSpeech: "Noun"
    },
    hyperbole: {
      ipa: { us: "/haɪˈpɜːrbəli/", uk: "/haɪˈpɜːbəli/" },
      syllables: { us: [s("hy", 0), s("pur", 1), s("buh", 0), s("lee", 0)], uk: [s("hy", 0), s("pur", 1), s("buh", 0), s("lee", 0)] },
      definition: "Exaggerated statements not meant to be taken literally.",
      partOfSpeech: "Noun"
    },
    quay: {
      ipa: { us: "/kiː/", uk: "/kiː/" },
      syllables: { us: [s("kee", 1)], uk: [s("kee", 1)] },
      definition: "A structure built along the edge of water where ships load and unload.",
      partOfSpeech: "Noun"
    },
    salmon: {
      ipa: { us: "/ˈsæmən/", uk: "/ˈsæmən/" },
      syllables: { us: [s("sam", 1), s("uhn", 0)], uk: [s("sam", 1), s("uhn", 0)] },
      definition: "A large edible fish with pink flesh, valued as food.",
      partOfSpeech: "Noun"
    },
    mischievous: {
      ipa: { us: "/ˈmɪstʃɪvəs/", uk: "/ˈmɪstʃɪvəs/" },
      syllables: { us: [s("mis", 1), s("chuh", 0), s("vuhs", 0)], uk: [s("mis", 1), s("chuh", 0), s("vuhs", 0)] },
      definition: "Causing or showing a fondness for playful trouble.",
      partOfSpeech: "Adjective"
    }
  };
})();
