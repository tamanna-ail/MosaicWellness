/** Ask the local engine from the terminal: npm run ask -- "When did my TSH first become abnormal?" */
import { seedSnapshot } from "../src/lib/data/seed";
import { answerQuestion } from "../src/lib/ai/engine";
const qs = process.argv.slice(2);
for (const q of qs) {
  const a = answerQuestion(seedSnapshot, q);
  console.log("\n=== " + q + "  [" + a.intent + "]");
  console.log(a.summary);
  for (const k of ["facts", "calculations", "interpretation"] as const) for (const i of a[k]) console.log(`  ${k[0].toUpperCase()} ${i.text}  {${(i.sources ?? []).length}}`);
  for (const g of a.gaps) console.log("  GAP " + g);
  console.log("  SOURCES " + a.sources.map((s) => s.title + " " + s.date).join(" | "));
}
