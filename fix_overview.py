import re

with open("src/app/admin/home-finance/page.tsx", "r") as f:
    content = f.read()

# Target strings to extract
quick_actions_re = re.compile(r'(\s*\{/\* Quick Actions Grid \*/\}.*?</div>\s*)(?=\n\s*\{/\* Alerts Banner \*/\})', re.DOTALL)
alerts_re = re.compile(r'(\s*\{/\* Alerts Banner \*/\}.*?\n\s*\)\}\s*)', re.DOTALL)
family_comp_re = re.compile(r'(\s*\{/\* Family Competition Overview \*/\}\s*<div className="mb-4">\s*<FamilyCompetitionOverview onClick=\{.*?\} />\s*</div>\s*)', re.DOTALL)
fin_cycle_re = re.compile(r'(\s*\{/\* Financial Cycle moved from Header \*/\}.*?PREMIUM BUDGET BREAKDOWN SECTION\n\s*══════════════════════════════════════════ \*/\}\n\s*</div>\n\s*\)\}\s*)', re.DOTALL)

q_match = quick_actions_re.search(content)
a_match = alerts_re.search(content)
fc_match = family_comp_re.search(content)
fin_match = fin_cycle_re.search(content)

if not (q_match and a_match and fc_match and fin_match):
    print("Could not match all!")
    exit(1)

# Remove all matches from content
content = content.replace(fin_match.group(1), "")
content = content.replace(fc_match.group(1), "")
content = content.replace(a_match.group(1), "")
content = content.replace(q_match.group(1), "")

# The order: Quick Actions -> Financial Cycle -> Family Comp -> Alerts
# Wait, I removed the `)}` at the end of fin_match which closes the `activeTab === "overview" && (` !
# I need to be careful. The `fin_match` includes the closing braces.
# Let's extract the closing braces from fin_match.
fin_content = fin_match.group(1)
fin_content_clean = fin_content.rsplit(")}", 1)[0]
closing = "        )}\n"

new_overview = (
    q_match.group(1) + 
    fin_content_clean + 
    fc_match.group(1) + 
    a_match.group(1) + 
    closing
)

# Now, where do I insert it?
# The placeholder is right after `{activeTab === "overview" && (\n          <div className="space-y-4">\n`
insert_pos = content.find('<div className="space-y-4">')
if insert_pos == -1:
    print("Could not find insert pos")
    exit(1)

# Wait, there are multiple space-y-4.
# Let's just use replace on a specific marker
marker = '{/* ═══════════════ OVERVIEW TAB ═══════════════ */}\n        {activeTab === "overview" && (\n          <div className="space-y-4">\n'
if marker not in content:
    print("Marker not found")
    exit(1)

content = content.replace(marker, marker + new_overview)

with open("src/app/admin/home-finance/page.tsx", "w") as f:
    f.write(content)

print("Overview reordered successfully!")
