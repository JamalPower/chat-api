const cheerio = require('cheerio');
class match {
   
 parseMatches(html) {
   const $ = cheerio.load(html);
   const matches = [];
   function convertRiyadhToMorocco(timeStr) {
    const trimmed = timeStr.trim();
    const [time, period] = trimmed.split(' '); 
    let [hours, minutes] = time.split(':').map(Number);
    if (period === 'AM') {
        if (hours === 12) hours = 0;   
    } else if (period === 'PM') {
        if (hours !== 12) hours += 12; 
    }
    let totalMinutes = hours * 60 + minutes - 120;
    if (totalMinutes < 0) totalMinutes += 24 * 60;

    const newHours   = Math.floor(totalMinutes / 60);
    const newMinutes = totalMinutes % 60;

    return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
 }
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
      time:convertRiyadhToMorocco(time),
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
parseMatchesNewsMain(html) {
  const $ = cheerio.load(html);
  const news = [];

  const arabicMonths = {
    'يناير': 0, 'فبراير': 1, 'مارس': 2, 'أبريل': 3,
    'مايو': 4, 'يونيو': 5, 'يوليو': 6, 'أغسطس': 7,
    'سبتمبر': 8, 'أكتوبر': 9, 'نوفمبر': 10, 'ديسمبر': 11
  };

  function timeAgo(time, date) {
    const [day, monthName, year] = date.trim().split(' ');
    const month = arabicMonths[monthName];
    const [hours, minutes] = time.trim().split(':').map(Number);

    if (month === undefined || isNaN(hours) || isNaN(minutes)) return '';

    const targetDate = new Date(year, month, day, hours, minutes, 0);
    const now = new Date();
    const diffMs      = now - targetDate;
    const diffMinutes = Math.floor(diffMs / 1000 / 60);
    const diffHours   = Math.floor(diffMinutes / 60);
    const diffDays    = Math.floor(diffHours / 24);
    const diffWeeks   = Math.floor(diffDays / 7);
    const diffMonths  = Math.floor(diffDays / 30);
    const diffYears   = Math.floor(diffDays / 365);

    if (diffMs < 0 || diffMinutes < 1) return 'الآن';
    if (diffMinutes < 60) {
      if (diffMinutes === 1) return 'قبل دقيقة';
      if (diffMinutes === 2) return 'قبل دقيقتين';
      if (diffMinutes <= 10) return `قبل ${diffMinutes} دقائق`;
      return `قبل ${diffMinutes} دقيقة`;
    }
    if (diffHours < 24) {
      if (diffHours === 1) return 'قبل ساعة';
      if (diffHours === 2) return 'قبل ساعتين';
      if (diffHours <= 10) return `قبل ${diffHours} ساعات`;
      return `قبل ${diffHours} ساعة`;
    }
    if (diffDays < 7) {
      if (diffDays === 1) return 'قبل يوم واحد';
      if (diffDays === 2) return 'قبل يومين';
      return `قبل ${diffDays} أيام`;
    }
    if (diffWeeks < 4) {
      if (diffWeeks === 1) return 'قبل أسبوع';
      if (diffWeeks === 2) return 'قبل أسبوعين';
      return `قبل ${diffWeeks} أسابيع`;
    }
    if (diffMonths < 12) {
      if (diffMonths === 1) return 'قبل شهر';
      if (diffMonths === 2) return 'قبل شهرين';
      if (diffMonths <= 10) return `قبل ${diffMonths} أشهر`;
      return `قبل ${diffMonths} شهراً`;
    }
    if (diffYears === 1) return 'قبل سنة';
    if (diffYears === 2) return 'قبل سنتين';
    return `قبل ${diffYears} سنوات`;
  }

  $(".fco-card").each((_, el) => {
    const $el = $(el);
    const title = $el.find("div.fco-card__headline").text().trim();
    const tag   = $el.find("div.fco-card__tags .fco-tag-text").text().trim();
    const time  = $el.find("div.fco-card__info .fco-card__info--time").text().trim();
    const date  = $el.find("div.fco-card__info .fco-card__info--date").text().trim();
    const href = $el.attr("href") || $el.find("a").first().attr("href") || "";
    const url = 'https://www.kooora.com' + href;
    const img   = $el.find(".fco-image img").attr("src");

    news.push({
      title,
      tag,
      timePast: timeAgo(time, date),
      url,
      time,
      date,
      img,
    });
  });

  return news;
}

parseCompetitions(html) {
  const $ = cheerio.load(html);
  const BASE_URL = 'https://www.kooora.com';
  const competitions = [];
  const seen = new Set(); 
 
  $("a.fco-competition-section__header").each((_, el) => {
    const $el = $(el);
 
    const name = $el.find(".fco-competition-section__header-name").text().trim();
    const area = $el.find(".fco-competition-section__header-area").text().trim();
    const href = $el.attr("href") || "";
    const url  = href.startsWith("http") ? href : `${BASE_URL}${href}`;
    const img  = $el.find(".fco-image img");
    const src  = img.attr("src") || "";
    const logo = src.startsWith("data:") ? (img.attr("data-src") || "") : src;
    if (!name || seen.has(name)) return;
    seen.add(name);
 
    competitions.push({ name, area, logo, url });
  });
 
  return competitions;
}

}

module.exports = match;
