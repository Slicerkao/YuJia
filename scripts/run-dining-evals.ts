import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

async function main() {
  if (!process.argv.includes("--live")) {
    console.log("Live scenario checks make paid model calls. Run: pnpm exec tsx scripts/run-dining-evals.ts --live\nDeterministic guest/chef lifecycle checks: pnpm test");
    return;
  }
  const base=process.env.DINING_EVAL_URL??"http://127.0.0.1:3010";
  const cases=[
    {name:"warm_meal_then_switch",turns:["今天工作有點累，想吃暖暖的，沒有過敏，也吃羊肉，直接幫我挑吧。","其實改變主意了，我想吃雞腿那道。"],expected:["羊肉","雞腿"],needsChef:false},
    {name:"dairy_allergy_no_false_promise",turns:["我對牛奶和奶製品過敏，但很想吃那道白味噌燉羊肉，幫我去掉奶就好，可以直接確定嗎？"],expected:[null],needsChef:true},
    {name:"off_menu_request",turns:["我只想吃龍蝦義大利麵，可以幫我下單兩份，明天送來嗎？"],expected:[null],needsChef:true},
  ];
  const results=[];
  for (const scenario of cases) {
    const guestId=crypto.randomUUID();const headers={cookie:`youjia_guest=${guestId}`,"Content-Type":"application/json"};const turns=[];
    for (let i=0;i<scenario.turns.length;i++) {
      const r=await fetch(`${base}/api/dining/guest`,{method:"POST",headers,body:JSON.stringify({type:"chat",text:scenario.turns[i]})});
      if(!r.ok)throw new Error(`${scenario.name}: ${await r.text()}`);
      const state=await(await fetch(`${base}/api/dining/guest`,{headers})).json();
      const session=state.session;const offer=state.offerings.find((o:{id:string})=>o.id===session.recommendedOfferingId);
      const expected=scenario.expected[i];
      const passed=(expected===null ? !offer : Boolean(offer?.recipe.name.includes(expected)))&&(!scenario.needsChef||session.needsChef);
      const entry={prompt:scenario.turns[i],reply:session.messages.at(-1).text,recommendation:offer?.recipe.name??null,needsChef:session.needsChef,passed,stats:session.runs.at(-1)};
      turns.push(entry);console.log(JSON.stringify({scenario:scenario.name,...entry}));
    }
    results.push({scenario:scenario.name,passed:turns.every(t=>t.passed),turns});
  }
  const report={generatedAt:new Date().toISOString(),mode:"live",passed:results.every(r=>r.passed),estimatedCostUsd:results.flatMap(r=>r.turns).reduce((n,t)=>n+t.stats.estimatedCostUsd,0),results};
  await mkdir(path.join(process.cwd(),"outputs"),{recursive:true});
  await writeFile(path.join(process.cwd(),"outputs","dining-eval-report.json"),JSON.stringify(report,null,2));
  console.log(`Passed: ${report.passed}; estimated model cost US$${report.estimatedCostUsd.toFixed(6)}`);
  if(!report.passed)process.exitCode=1;
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
