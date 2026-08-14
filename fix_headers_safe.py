import os
import re

base_dir = "/Users/haiderrahman/Work/antigravity/Cake-Publisher/src/app/admin"
pages = [
    "categories/page.tsx",
    "banners/page.tsx",
    "offers/page.tsx",
    "ads/page.tsx",
    "competitions/page.tsx",
    "custom-orders/page.tsx",
    "inventory/page.tsx",
    "products/page.tsx",
    "orders/page.tsx"
]

header_template = """      {/* ═══════════════ HEADER ═══════════════ */}
      <div className="relative bg-gradient-to-br from-[#1a0533] via-[#2d1060] to-[#0f3460] pt-20 pb-6 px-5 overflow-hidden mb-6">
        <div className="absolute top-0 right-0 w-72 h-72 bg-purple-600/20 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/15 blur-[80px] rounded-full translate-y-1/2 -translate-x-1/4 pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="w-10 h-10 bg-white/15 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 hover:bg-white/25 transition">
              <ArrowRight className="w-5 h-5 text-white" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-white">{title}</h1>
              {subtitle}
            </div>
          </div>
          {buttons}
        </div>
      </div>"""

for page in pages:
    filepath = os.path.join(base_dir, page)
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    start_str = '<div className="px-5 pt-6 pb-4 flex flex-col gap-4">'
    start_idx = content.find(start_str)
    if start_idx == -1:
        print("Not found", page)
        continue

    div_count = 0
    i = start_idx
    end_idx = -1
    while i < len(content):
        if content[i:i+4] == '<div':
            div_count += 1
            i += 4
        elif content[i:i+6] == '</div>':
            div_count -= 1
            if div_count == 0:
                end_idx = i + 6
                break
            i += 6
        else:
            i += 1
            
    header_block = content[start_idx:end_idx]

    h1_match = re.search(r'<h1 className="[^"]*">(.*?)</h1>', header_block)
    title = h1_match.group(1) if h1_match else ""
    
    p_match = re.search(r'<p className="[^"]*">(.*?)</p>', header_block)
    subtitle = f'<p className="text-xs text-purple-200">{p_match.group(1)}</p>' if p_match else ""
    
    button_part = ""
    btn_start = header_block.find('<button')
    if btn_start != -1:
        btn_end = header_block.find('</button>', btn_start) + 9
        button_part = header_block[btn_start:btn_end]
        button_part = button_part.replace('bg-gray-200 text-gray-600', 'bg-white/15 text-white border border-white/20')
        button_part = button_part.replace('dark:bg-zinc-800 dark:text-gray-300', 'hover:bg-white/20')
        button_part = button_part.replace('backdrop-blur-md', '')
        if 'rounded-xl' in button_part and 'backdrop-blur-md' not in button_part:
            button_part = button_part.replace('rounded-xl', 'rounded-xl backdrop-blur-md')
            
    new_header = header_template.replace('{title}', title).replace('{subtitle}', subtitle).replace('{buttons}', button_part)
    
    new_content = content[:start_idx] + new_header + content[end_idx:]
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Updated", page)

