import os

with open('app/(owner)/(tabs)/overview.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Replace useEffect
effect_start = -1
effect_end = -1
for i, line in enumerate(lines):
    if '  useEffect(() => {' in line and 'if (hasNoMemberships) return;' in lines[i+1]:
        effect_start = i
    if effect_start != -1 and '  }, [hasNoMemberships, responsivePadding]);' in line:
        effect_end = i
        break

if effect_start != -1:
    new_effect = [
        '  useEffect(() => {\n',
        '    if (hasNoMemberships) return;\n',
        '    const interval = setInterval(() => {\n',
        '      const itemWidth = Dimensions.get("window").width - (responsivePadding * 2) + 16;\n',
        '      if (activeCarouselIndex.current === 3) {\n',
        '        carouselRef.current?.scrollTo({ x: 0, animated: false });\n',
        '        activeCarouselIndex.current = 1;\n',
        '        setTimeout(() => {\n',
        '          carouselRef.current?.scrollTo({ x: itemWidth, animated: true });\n',
        '        }, 50);\n',
        '      } else {\n',
        '        activeCarouselIndex.current += 1;\n',
        '        carouselRef.current?.scrollTo({ x: activeCarouselIndex.current * itemWidth, animated: true });\n',
        '      }\n',
        '    }, 4000);\n',
        '    return () => clearInterval(interval);\n',
        '  }, [hasNoMemberships, responsivePadding]);\n'
    ]
    lines = lines[:effect_start] + new_effect + lines[effect_end+1:]

# Find Hero Card and ScrollView end
hero_start = -1
hero_end = -1
scroll_end = -1

for i, line in enumerate(lines):
    if '{/* ── 1. Property Hero Card' in line:
        hero_start = i - 1 # Include the <View> wrapper
    if hero_start != -1 and '{/* ── 4. Revenue Overview Card' in line:
        hero_end = i - 2 # The </View> before Revenue Card
    if '{/* ── 2. Key Metrics Grid' in line:
        # Find the </ScrollView> before this
        for j in range(i, -1, -1):
            if '</ScrollView>' in lines[j]:
                scroll_end = j
                break

if hero_start != -1 and hero_end != -1 and scroll_end != -1:
    hero_block = lines[hero_start:hero_end+1]
    # Replace comment to indicate duplicated block
    for i, line in enumerate(hero_block):
        if '1. Property Hero Card' in line:
            hero_block[i] = line.replace('1. Property Hero Card', '1. Property Hero Card (Duplicate for loop)')
    
    lines = lines[:scroll_end] + hero_block + lines[scroll_end:]

with open('app/(owner)/(tabs)/overview.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print('Success')
