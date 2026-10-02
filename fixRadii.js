const fs = require('fs');

const p1 = 'src/features/groceries/components/grocery/PromoCards.tsx';
let c1 = fs.readFileSync(p1, 'utf8');
c1 = c1.replace("import { GroceryColors } from '@/theme';", "import { GroceryColors, Radii } from '@/theme';");
fs.writeFileSync(p1, c1);

const p2 = 'src/features/groceries/screens/GroceryCategoryScreen.tsx';
let c2 = fs.readFileSync(p2, 'utf8');
c2 = c2.replace("import { GroceryColors } from '@/theme';", "import { GroceryColors, Radii } from '@/theme';");
fs.writeFileSync(p2, c2);

const p3 = 'src/features/staff/ChefGroceriesShortcut.tsx';
let c3 = fs.readFileSync(p3, 'utf8');
c3 = c3.replace("import { Colors, Palette } from '@/theme';", "import { Colors, Palette, Radii } from '@/theme';");
fs.writeFileSync(p3, c3);
