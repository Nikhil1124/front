/**
 * Makes a meal push on Android look like the app's own meal card (MealAdNotificationCard.tsx),
 * whether the app is open or closed: title, chef and menu, Eat and Skip, and the sponsor.
 *
 * Why the app has to draw it itself: when a push carries a `notification` block and the app is
 * closed, Android draws it and never asks the app — so it gets none of the app's buttons, let
 * alone its layout. The backend therefore sends meal pushes data-only, and expo-notifications
 * builds them in every state. Out of the box Expo then gets two things wrong:
 *
 *   1. It only reads an image from the `notification` block, which a data-only push does not
 *      have. Edit 1 also reads `data["image"]`.
 *   2. It draws every push with the standard template, and uses the image only as the square
 *      thumbnail. Edit 2 hands meal pushes to PgowMealCard.kt, a custom layout; anything else
 *      keeps the template, with its image as a full-width banner cropped to 2:1.
 *
 * PgowMealCard.kt and its layouts live in scripts/expo-notifications/, laid out like the
 * module's android/src/main/, and are copied over it here.
 *
 * Only takes effect because package.json sets `expo.autolinking.android.buildFromSource` for
 * expo-notifications: Expo ships the module precompiled, and a precompiled AAR ignores any
 * change to its source.
 *
 * Runs on postinstall. Each edit is idempotent, and the script fails loudly if an Expo upgrade
 * has changed a line it edits — a silent no-op would quietly bring the old behaviour back.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(
  __dirname, '..', 'node_modules', 'expo-notifications', 'android', 'src', 'main', 'java',
  'expo', 'modules', 'notifications', 'notifications',
);

const EDITS = [
  {
    file: path.join(root, 'model', 'RemoteNotificationContent.kt'),
    mark: 'PGow: image from data',
    from: [
      '  override suspend fun getImage(context: Context): Bitmap? {',
      '    val uri = remoteMessage.notification?.imageUrl',
      '    return uri?.let { downloadImage(it) }',
      '  }',
      '',
      '  override fun containsImage(): Boolean {',
      '    return remoteMessage.notification?.imageUrl != null',
      '  }',
    ].join('\n'),
    to: [
      '  override suspend fun getImage(context: Context): Bitmap? {',
      '    // PGow: image from data — a data-only push carries its banner in data["image"].',
      '    val uri = remoteMessage.notification?.imageUrl',
      '      ?: remoteMessage.data["image"]?.let { android.net.Uri.parse(it) }',
      '    return uri?.let { downloadImage(it) }',
      '  }',
      '',
      '  override fun containsImage(): Boolean {',
      '    return remoteMessage.notification?.imageUrl != null || remoteMessage.data["image"] != null',
      '  }',
    ].join('\n'),
  },
  {
    file: path.join(root, 'presentation', 'builders', 'ExpoNotificationBuilder.kt'),
    mark: 'PGow: meal card',
    from: [
      '    if (notificationContent.containsImage()) {',
      '      val bitmap = notificationContent.getImage(context)',
      '      bitmap?.let { builder.setLargeIcon(it) }',
      '    } else {',
      '      builder.setLargeIcon(largeIcon)',
      '    }',
    ].join('\n'),
    to: [
      '    // PGow: meal card — a meal push is drawn as the app\'s meal card (PgowMealCard.kt).',
      '    // Anything else keeps this template, its image a full-width banner cropped to 2:1',
      '    // rather than only the thumbnail. See scripts/patch-expo-notifications.js in the app.',
      '    val bitmap = if (notificationContent.containsImage()) notificationContent.getImage(context) else null',
      '    val category = notificationContent.categoryId?.let { runCatching { store.getNotificationCategory(it) }.getOrNull() }',
      '    val drawnAsCard = PgowMealCard.apply(context, builder, notification, category, bitmap)',
      '    if (!drawnAsCard && bitmap != null) {',
      '      builder.setLargeIcon(bitmap)',
      '      builder.setStyle(NotificationCompat.BigPictureStyle().bigPicture(PgowMealCard.crop(bitmap, 2)).bigLargeIcon(null as Bitmap?))',
      '    } else if (!drawnAsCard && !notificationContent.containsImage()) {',
      '      builder.setLargeIcon(largeIcon)',
      '    }',
    ].join('\n'),
  },
];

const moduleMain = path.join(__dirname, '..', 'node_modules', 'expo-notifications', 'android', 'src', 'main');
fs.cpSync(path.join(__dirname, 'expo-notifications'), moduleMain, { recursive: true });

let failed = false;
for (const { file, mark, from, to } of EDITS) {
  const name = path.basename(file);
  if (!fs.existsSync(file)) {
    console.error(`patch-expo-notifications: ${file} not found`);
    failed = true;
    continue;
  }
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes(mark)) continue;
  if (!source.includes(from)) {
    console.error(
      `patch-expo-notifications: ${name} has changed and the code this patch edits is gone.\n` +
      'Re-check whether the installed expo-notifications now does this itself.',
    );
    failed = true;
    continue;
  }
  fs.writeFileSync(file, source.replace(from, to));
  console.log(`patch-expo-notifications: patched ${name}`);
}
if (failed) process.exit(1);
