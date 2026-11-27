"""Print the minimum review evidence for this synthetic, trusted rehearsal."""
from pathlib import Path
import json, os, re, subprocess, sys
base=Path(os.environ['RUNNER_TEMP'])/'evaluated'
suite='packages/ai/src/ui/last-assistant-message-is-complete-with-tool-calls.test.ts'
selected={'mixed':['weakened','repair'],'repaired':['repair']}[sys.argv[1]]
rev=json.loads(Path('review-revisions.json').read_text())
tool=Path(os.environ['RUNNER_TEMP'])/'reviewer/plugins/tokensand-agent-pack/skills/tokensand-agent-pack/scripts/review_vitest.py'
cmd=[sys.executable,'-B',str(tool),'--before-root',str(base/'baseline'),'--replay-original-tests']
for name in selected:
    cmd.extend(['--after-root',str(base/name)])
cmd.append(suite)
p=subprocess.run(cmd,capture_output=True,text=True,timeout=140)
log=p.stdout
out=['## Agent tool completion','', 'Reference revision `'+rev['baseline']+'`','',
     '| Proposal revision | Submitted tests | Original tests | Release decision |',
     '| --- | ---: | ---: | --- |']
ok=p.returncode in (0,100)
if ok:
    reports=re.split(r'(?m)^Proposal [0-9]+ "[a-z]+"\n',log)[1:] if len(selected)>1 else [log]
    ok=len(reports)==len(selected)
    for name,part in zip(selected,reports):
        sub=re.search(r'(?m)^Vitest-reported passes: (\d+)/(\d+) before, (\d+)/(\d+) after\.',part)
        orig=re.search(r'(?m)^Original tests \((?:replayed|submitted run)\): (\d+)/(\d+) passed, (\d+) failed\.',part)
        decision=re.search(r'(?m)^(HOLD|VERIFIED REPAIR) — selected local Vitest cases$',part)
        if not (sub and orig and decision):
            ok=False
            break
        out.append(f'| `{rev[name]}` | {sub[3]}/{sub[4]} | {orig[1]}/{orig[2]} | {decision[1]} |')
if ok:
    out+=['', 'Keep the original assertion and fix the pending tool case.' if p.returncode==100 else 'The selected workflow is ready for the next release check.']
else:
    out=['## Agent tool completion', '', 'Original results unavailable. Run the pinned reviewer locally against the same source revisions before releasing.']
out.append('')
text='\n'.join(out)
with Path(os.environ['GITHUB_STEP_SUMMARY']).open('a') as f:f.write(text)
print(text)
# The actual release review exit reaches the GitHub job.
sys.exit(p.returncode if ok else 1)
