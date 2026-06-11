const cheerio = require('cheerio');

class match {
   
 parseMatches(html) {
   const $ = cheerio.load(html);
   const matches = [];
 
  $(".AY_Match").each((_, el) => {
    const $el = $(el);
    const status = $el.hasClass("finished")
      ? "finished"
      : $el.hasClass("live")
      ? "live"
      : "not-started";
    const team1 = $el.find(".TM1 .TM_Name").text().trim();
    const team2 = $el.find(".TM2 .TM_Name").text().trim();
    const getImg = (selector) => {
      const img = $el.find(selector);
      const src = img.attr("src") || "";
      return src.startsWith("data:") ? (img.attr("data-src") || "") : src;
    };
    const logo1 = getImg(".TM1 .TM_Logo img");
    const logo2 = getImg(".TM2 .TM_Logo img");
    const goals = $el.find(".RS-goals");
    const Score1 = status !== "not-started" ? parseInt($(goals[0]).text()) : null;
    const Score2 = status !== "not-started" ? parseInt($(goals[1]).text()) : null;
    const time = $el.find(".MT_Time").text().trim();
    const stat = $el.find(".MT_Stat").text().trim();
    const infoItems = [];
    $el.find(".MT_Info li span").each((_, span) => {
      infoItems.push($(span).text().trim());
    });
    const [channel = "", venue = "", competition = ""] = infoItems;
    const detailsUrl = $el.find("a").first().attr("href") || "";
    matches.push({
      status,
      time,
      stat,
      team1,
      team2,
      logo1,
      logo2,
      score: Score1 !== null ? { Team1Score: Score1, Team2Score: Score2 } : null,
      channel:     channel     !== "غير معروف" && channel     ? channel     : null,
      venue:       venue       !== "غير معروف" && venue       ? venue       : null,
      competition: competition !== "غير معروف" && competition ? competition : null,
      detailsUrl,
    });
  });
 
  return matches;
}

}

module.exports = match;
