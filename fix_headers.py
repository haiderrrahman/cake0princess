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
    "expenses/page.tsx",
    "external-orders/page.tsx",
    "orders/page.tsx",
    "customers/page.tsx"
]

header_template = """      <div className="relative bg-gradient-to-br from-[#1a0533] via-[#2d1060] to-[#0f3460] pt-20 pb-6 px-5 overflow-hidden">
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
      </div>
"""

# Pattern to find the existing header container and extract title, subtitle and buttons
# Some pages have a subtitle, some don't.
# Some pages have a button, some don't.

for page in pages:
    filepath = os.path.join(base_dir, page)
    if not os.path.exists(filepath):
        print(f"Skipping {page}, not found.")
        continue
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Standard header pattern match
    # Usually starts with <div className="px-5 pt-6 pb-4 flex flex-col gap-4">
    # Ends with </div>\s*</div> right before the content div
    
    # Let's use a simpler approach: finding the H1 tag first
    h1_match = re.search(r'<h1 className="[^"]*">(.*?)</h1>', content)
    if not h1_match:
        print(f"H1 not found in {page}")
        continue
        
    title = h1_match.group(1)
    
    # Try to find subtitle (usually a <p> tag right after h1)
    p_match = re.search(r'<p className="[^"]*">(.*?)</p>', content)
    subtitle = f'<p className="text-xs text-purple-200">{p_match.group(1)}</p>' if p_match else ""
    
    # Try to find the button inside the flex items-center justify-between div
    # The header is inside <div className="px-5 pt-6 pb-4
    header_block_match = re.search(r'<div className="px-5 pt-6 pb-4[^>]*>.*?<div className="flex items-center justify-between">(.*?)</div>\s*</div>', content, re.DOTALL)
    
    if not header_block_match:
        print(f"Header block not matched in {page}")
        continue
        
    inner_content = header_block_match.group(1)
    
    # Extract button if it exists (it's the element after the flex items-center gap-3 div)
    button_part = ""
    # We can isolate the button by finding everything after the Link div
    btn_match = re.search(r'</div>\s*(<button.*?</button>)\s*$', inner_content, re.DOTALL)
    if btn_match:
        button_part = btn_match.group(1)
        # Update button text color to be visible on dark bg if it was gray
        button_part = button_part.replace('bg-gray-200 text-gray-600', 'bg-white/15 text-white border border-white/20')
        button_part = button_part.replace('dark:bg-zinc-800 dark:text-gray-300', 'hover:bg-white/20')
        button_part = button_part.replace('backdrop-blur-md', '')
        button_part = button_part.replace('rounded-xl', 'rounded-xl backdrop-blur-md')
        
    new_header = header_template.replace('{title}', title).replace('{subtitle}', subtitle).replace('{buttons}', button_part)
    
    # Replace the old header with the new one
    new_content = content[:header_block_match.start()] + new_header + content[header_block_match.end():]
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
        
    print(f"Updated {page}")

