import re

with open("src/app/admin/home-finance/page.tsx", "r") as f:
    content = f.read()

# Target strings to extract
quick_actions_re = re.compile(r'(\s*\{/\* Quick Actions Grid \*/\}.*?</div>\s*)(?=\n\s*\{/\* Alerts Banner \*/\})', re.DOTALL)
alerts_re = re.compile(r'(\s*\{/\* Alerts Banner \*/\}.*?\n\s*\)\}\s*)', re.DOTALL)
decor_re = re.compile(r'(\s*<div className="absolute bottom-0.*?\n\s*<div className="absolute top-0.*?\n)', re.DOTALL)
family_comp_re = re.compile(r'(\s*\{/\* Family Competition Overview \*/\}\s*<div className="mb-4">\s*<FamilyCompetitionOverview onClick=\{.*?\} />\s*</div>\s*)', re.DOTALL)
fin_cycle_re = re.compile(r'(\s*\{/\* Financial Cycle moved from Header \*/\}.*?PREMIUM BUDGET BREAKDOWN SECTION\n\s*══════════════════════════════════════════ \*/\}\n\s*</div>)', re.DOTALL)

q_match = quick_actions_re.search(content)
a_match = alerts_re.search(content)
d_match = decor_re.search(content)
fc_match = family_comp_re.search(content)
fin_match = fin_cycle_re.search(content)

if not (q_match and a_match and d_match and fc_match and fin_match):
    print("Could not match all!")
    exit(1)

# Extract original block text to replace it entirely
orig_block_re = re.compile(r'(\s*\{/\* Quick Actions Grid \*/\}.*?PREMIUM BUDGET BREAKDOWN SECTION\n\s*══════════════════════════════════════════ \*/\}\n\s*<\/div>)', re.DOTALL)
orig_block_match = orig_block_re.search(content)
if not orig_block_match:
    print("orig block failed")
    exit(1)

# Order: Fin -> Quick Actions -> Family Comp -> Alerts -> Decor
new_overview = (
    fin_match.group(1) + 
    q_match.group(1) + 
    fc_match.group(1) + 
    a_match.group(1) + 
    d_match.group(1)
)

content = content.replace(orig_block_match.group(1), new_overview)

with open("src/app/admin/home-finance/page.tsx", "w") as f:
    f.write(content)

print("Overview replaced successfully!")
