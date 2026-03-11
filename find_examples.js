const r = require("./reviews_serpapi.json");
const wc = r.filter(x => x.comment !== "(no comment)");

const four = wc.filter(x => x.starRating === 4 && x.comment.length > 40);
console.log("=== 4-star with mild concern ===");
four.slice(0, 5).forEach((x,i) => { console.log("["+i+"] " + x.comment.slice(0,300)); console.log(""); });

const fr = wc.filter(x => /très|était|nous avons|Catastroph|plutôt|apparemment/i.test(x.comment));
console.log("=== French ===");
fr.slice(0,3).forEach((x,i) => { console.log("["+i+"] s"+x.starRating+" | "+x.comment.slice(0,300)); console.log(""); });

const es = wc.filter(x => /noche|fue un|pero |muy |nunca repetir|desastre|platos/i.test(x.comment));
console.log("=== Spanish ===");
es.slice(0,5).forEach((x,i) => { console.log("["+i+"] s"+x.starRating+" | "+x.comment.slice(0,250)); console.log(""); });

const fork = wc.filter(x => /fork|desconto/i.test(x.comment));
console.log("=== TheFork / discount ===");
fork.slice(0,5).forEach((x,i) => { console.log("["+i+"] s"+x.starRating+" | "+x.comment.slice(0,300)); console.log(""); });
