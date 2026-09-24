package expo.modules.notifications.notifications.presentation.builders

import android.content.Context
import android.graphics.Bitmap
import android.view.View
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import expo.modules.notifications.R
import expo.modules.notifications.notifications.model.Notification
import expo.modules.notifications.notifications.model.NotificationCategory
import expo.modules.notifications.notifications.model.triggers.FirebaseNotificationTrigger
import expo.modules.notifications.service.NotificationsService.Companion.createNotificationResponseIntent
import java.util.Calendar
import java.util.Locale

/**
 * PGow: the app's meal card (MealAdNotificationCard.tsx) drawn in the notification shade —
 * title, chef and menu, Eat and Skip, then the sponsor with its banner and button.
 *
 * Kept in the app repository under scripts/expo-notifications/ and copied into
 * expo-notifications on postinstall by scripts/patch-expo-notifications.js. Edit it there.
 *
 * Only for a remote meal push (categoryId MEAL_RSVP / MEAL_RSVP_PROMO). Its buttons fire the
 * category's own action intents, so a tap reaches the app's background task exactly as the
 * standard "I'll eat" button did and nothing on the JS side changes.
 *
 * The text comes from the push's data: `chef`, `menu`, `serviceAt`, `adBrand`, `adTagline`,
 * `adCta`, each optional (see `_gcm_payload` in the backend). A reminder, or an older server,
 * sends none of them, and the card falls back to the title and the message text.
 *
 * Android only. iOS would need a Notification Content Extension, which the app does not have.
 */
internal object PgowMealCard {
  private val CATEGORIES = setOf("MEAL_RSVP", "MEAL_RSVP_PROMO")
  private val ICON = mapOf(
    "breakfast" to R.drawable.pgow_ic_breakfast,
    "lunch" to R.drawable.pgow_ic_lunch,
    "dinner" to R.drawable.pgow_ic_dinner,
  )

  // A notification's views cross the binder in one transaction; a full-size photo can push
  // it over the limit and the notification is silently dropped.
  private const val MAX_WIDTH = 720

  /** Returns false, leaving the builder untouched, when this is not a meal push. */
  fun apply(
    context: Context,
    builder: NotificationCompat.Builder,
    notification: Notification,
    category: NotificationCategory?,
    picture: Bitmap?
  ): Boolean {
    val content = notification.notificationRequest.content
    if (content.categoryId !in CATEGORIES) return false
    val data = (notification.notificationRequest.trigger as? FirebaseNotificationTrigger)
      ?.remoteMessage?.data ?: return false

    val actions = category?.actions.orEmpty().associateBy { it.identifier }
    fun intent(id: String) = actions[id]?.let { createNotificationResponseIntent(context, notification, it) }
    val eat = intent("EAT")
    val skip = intent("SKIP")
    val offer = intent("PROMO_CTA")

    val meal = content.title.orEmpty()  // "Lunch" — the server sends the meal type as the title
    val heading = data["serviceAt"]?.toLongOrNull()?.let { dayOf(it) }
      ?.let { "$it's ${meal.lowercase()}" } ?: meal
    val chef = data["chef"].orEmpty()
    val menu = data["menu"].orEmpty().split(',').map { it.trim() }.filter { it.isNotEmpty() }
      .joinToString(" • ").ifEmpty { content.text.orEmpty() }
    val brand = data["adBrand"].orEmpty()
    val tagline = data["adTagline"].orEmpty()

    fun views(layout: Int) = RemoteViews(context.packageName, layout).apply {
      setImageViewResource(R.id.pgow_icon, ICON[meal.lowercase()] ?: R.drawable.pgow_ic_lunch)
      setTextViewText(R.id.pgow_title, heading)
    }
    fun RemoteViews.buttons() = apply {
      if (eat != null && skip != null) {
        setOnClickPendingIntent(R.id.pgow_eat, eat)
        setOnClickPendingIntent(R.id.pgow_skip, skip)
      } else {
        // The category is registered when the app first starts; until then there is nothing
        // for the buttons to fire.
        setViewVisibility(R.id.pgow_buttons, View.GONE)
      }
    }

    val collapsed = views(R.layout.pgow_meal_card_small).apply { setTextViewText(R.id.pgow_menu, menu) }
    val headsUp = views(R.layout.pgow_meal_card_heads_up).buttons()
    val big = views(R.layout.pgow_meal_card).buttons().apply {
      setTextViewText(R.id.pgow_chef, "By chef $chef")
      setViewVisibility(R.id.pgow_chef, visibleIf(chef.isNotEmpty()))
      setTextViewText(R.id.pgow_menu, menu)
      setViewVisibility(R.id.pgow_ad, visibleIf(picture != null || brand.isNotEmpty()))
      setTextViewText(R.id.pgow_ad_label, if (brand.isEmpty()) "Ad" else "Ad · served by $brand")
      if (picture != null) {
        setImageViewBitmap(R.id.pgow_ad_image, crop(picture, 4))
      } else {
        setViewVisibility(R.id.pgow_ad_image, View.GONE)
      }
      setViewVisibility(R.id.pgow_ad_row, visibleIf(brand.isNotEmpty()))
      setTextViewText(R.id.pgow_ad_brand, brand)
      setTextViewText(R.id.pgow_ad_tagline, tagline)
      setViewVisibility(R.id.pgow_ad_tagline, visibleIf(tagline.isNotEmpty()))
      if (offer != null) {
        setTextViewText(R.id.pgow_ad_cta, data["adCta"].orEmpty().ifEmpty { "View offer" })
        setOnClickPendingIntent(R.id.pgow_ad_cta, offer)
        setOnClickPendingIntent(R.id.pgow_ad_image, offer)
      } else {
        setViewVisibility(R.id.pgow_ad_cta, View.GONE)
      }
    }

    // The card draws its own buttons. Left in, the template would repeat them as a row of
    // plain text actions underneath it.
    builder.clearActions()
    builder.setStyle(NotificationCompat.DecoratedCustomViewStyle())
    builder.setCustomContentView(collapsed)
    builder.setCustomHeadsUpContentView(headsUp)
    builder.setCustomBigContentView(big)
    // The design's violet on the header's house icon, in place of the server's accent.
    builder.color = ContextCompat.getColor(context, R.color.pgow_violet)
    return true
  }

  /** "Today", "Tomorrow" or a weekday within the week, in the phone's own timezone; else null. */
  private fun dayOf(epochMillis: Long): String? {
    fun startOfDay(c: Calendar) = c.apply {
      set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
    }.timeInMillis
    val service = Calendar.getInstance().apply { timeInMillis = epochMillis }
    val days = Math.round((startOfDay(service.clone() as Calendar) - startOfDay(Calendar.getInstance())) / 86_400_000.0)
    return when (days) {
      0L -> "Today"
      1L -> "Tomorrow"
      in 2L..6L -> service.getDisplayName(Calendar.DAY_OF_WEEK, Calendar.LONG, Locale.ENGLISH)
      else -> null
    }
  }

  /** Centre-crops to at most `ratio`:1 and caps the width at [MAX_WIDTH]. */
  fun crop(src: Bitmap, ratio: Int): Bitmap {
    val height = minOf(src.height, src.width / ratio)
    val cropped = Bitmap.createBitmap(src, 0, (src.height - height) / 2, src.width, height)
    if (cropped.width <= MAX_WIDTH) return cropped
    return Bitmap.createScaledBitmap(cropped, MAX_WIDTH, cropped.height * MAX_WIDTH / cropped.width, true)
  }

  private fun visibleIf(show: Boolean) = if (show) View.VISIBLE else View.GONE
}
