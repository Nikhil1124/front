import os

with open('app/(owner)/(tabs)/overview.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

hero_start = -1
hero_end = -1
metrics_start = -1
metrics_end = -1
quick_start = -1
quick_end = -1
revenue_start = -1
revenue_end = -1
food_start = -1
food_end = -1

for i, line in enumerate(lines):
    if '{/* ── 1. Property Hero Card' in line:
        hero_start = i
    if hero_start != -1 and '        <Spacer size={20} />' in line and i > hero_start and metrics_start == -1:
        hero_end = i - 1
    if '{/* ── 2. Key Metrics Grid' in line:
        metrics_start = i
    if metrics_start != -1 and '        <Spacer size={24} />' in line and i > metrics_start and quick_start == -1:
        metrics_end = i - 1
    if '{/* ── 3. Quick Actions' in line:
        quick_start = i
    if quick_start != -1 and '        <Spacer size={24} />' in line and i > quick_start and revenue_start == -1:
        quick_end = i - 1
    if '{/* ── 4. Revenue Overview Card' in line:
        revenue_start = i
    if revenue_start != -1 and '        <Spacer size={20} />' in line and i > revenue_start and food_start == -1:
        revenue_end = i - 1
    if '{/* ── Food Savings Analytics Card' in line:
        food_start = i
    if food_start != -1 and '        <Spacer size={20} />' in line and i > food_start and i < 600:
        food_end = i - 1

print(f'Hero: {hero_start}-{hero_end}')
print(f'Metrics: {metrics_start}-{metrics_end}')
print(f'Quick: {quick_start}-{quick_end}')
print(f'Revenue: {revenue_start}-{revenue_end}')
print(f'Food: {food_start}-{food_end}')

if -1 in [hero_start, hero_end, metrics_start, metrics_end, quick_start, quick_end, revenue_start, revenue_end, food_start, food_end]:
    print('Failed to find all blocks!')
    exit(1)

new_lines = lines[:hero_start]

new_lines.append('            {/* ── Dashboard Carousel ─────────────────────────────────────── */}\n')
new_lines.append('            <ScrollView\n')
new_lines.append('              horizontal\n')
new_lines.append('              showsHorizontalScrollIndicator={false}\n')
new_lines.append('              snapToInterval={Dimensions.get("window").width - (responsivePadding * 2) + 16}\n')
new_lines.append('              decelerationRate="fast"\n')
new_lines.append('              disableIntervalMomentum\n')
new_lines.append('              contentContainerStyle={{ paddingHorizontal: responsivePadding, gap: 16 }}\n')
new_lines.append('              style={{ marginHorizontal: -responsivePadding }}\n')
new_lines.append('            >\n')

# Hero
new_lines.append('              <View style={{ width: Dimensions.get("window").width - (responsivePadding * 2) }}>\n')
for i in range(hero_start, hero_end + 1):
    new_lines.append('  ' + lines[i])
new_lines.append('              </View>\n')

# Revenue
new_lines.append('              <View style={{ width: Dimensions.get("window").width - (responsivePadding * 2) }}>\n')
for i in range(revenue_start, revenue_end + 1):
    new_lines.append('  ' + lines[i])
new_lines.append('              </View>\n')

# Food
new_lines.append('              <View style={{ width: Dimensions.get("window").width - (responsivePadding * 2) }}>\n')
for i in range(food_start, food_end + 1):
    new_lines.append('  ' + lines[i])
new_lines.append('              </View>\n')

new_lines.append('            </ScrollView>\n\n')
new_lines.append('            <Spacer size={24} />\n\n')

# Metrics
for i in range(metrics_start, metrics_end + 1):
    new_lines.append(lines[i])
new_lines.append('\n            <Spacer size={24} />\n\n')

# Quick Actions
for i in range(quick_start, quick_end + 1):
    new_lines.append(lines[i])
new_lines.append('\n            <Spacer size={24} />\n\n')

new_lines.extend(lines[food_end + 2:])

with open('app/(owner)/(tabs)/overview.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print('Success!')
