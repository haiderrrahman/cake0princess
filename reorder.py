import re

with open("src/app/admin/home-finance/page.tsx", "r") as f:
    lines = f.readlines()

start_idx = -1
for i, line in enumerate(lines):
    if '{/* ═══════════════ OVERVIEW TAB ═══════════════ */}' in line:
        start_idx = i
        break

if start_idx == -1:
    print("Could not find overview tab")
    exit(1)

# Find the end of overview tab. It ends right before "INCOME TAB"
end_idx = -1
for i in range(start_idx, len(lines)):
    if '{/* ═══════════════ INCOME TAB ═══════════════ */}' in line:
        end_idx = i
        break

overview_content = "".join(lines[start_idx:end_idx])

# Extract sections
quick_actions_re = re.compile(r'(\s*\{/\* Quick Actions Grid \*/\}.*?)(?=\s*\{/\* Alerts Banner \*/\})', re.DOTALL)
alerts_re = re.compile(r'(\s*\{/\* Alerts Banner \*/\}.*?(?:\n\s*\}\)\s*\n))', re.DOTALL)
decorative_re = re.compile(r'(\s*<div className="absolute bottom-0.*?\n\s*<div className="absolute top-0.*?\n)', re.DOTALL)
family_comp_re = re.compile(r'(\s*\{/\* Family Competition Overview \*/\}.*?(?:\n\s*</div>\s*\n))', re.DOTALL)
financial_cycle_re = re.compile(r'(\s*\{/\* Financial Cycle moved from Header \*/\}.*?PREMIUM BUDGET BREAKDOWN SECTION\n\s*══════════════════════════════════════════ \*/\}\n\s*</div>\n)', re.DOTALL)

q_match = quick_actions_re.search(overview_content)
a_match = alerts_re.search(overview_content)
d_match = decorative_re.search(overview_content)
fc_match = family_comp_re.search(overview_content)
fin_match = financial_cycle_re.search(overview_content)

if not (q_match and a_match and d_match and fc_match and fin_match):
    print("Could not find all sections")
    print("Q:", bool(q_match), "A:", bool(a_match), "D:", bool(d_match), "FC:", bool(fc_match), "FIN:", bool(fin_match))
    exit(1)

# Reassemble
new_overview = (
    lines[start_idx] +
    lines[start_idx+1] +
    lines[start_idx+2] +
    fin_match.group(1) +
    d_match.group(1) +
    fc_match.group(1) +
    a_match.group(1) +
    q_match.group(1) +
    "        )}\n\n"
)

# replace in file
with open("src/app/admin/home-finance/page.tsx", "w") as f:
    f.writelines(lines[:start_idx])
    f.write(new_overview)
    f.writelines(lines[end_idx:])

print("Successfully reordered overview tab")
