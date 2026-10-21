# Sales Updater native splash

Uses the existing Expo SDK 54 (`expo-splash-screen` 31.0.13). No new dependencies.

The transparent spreadsheet/growth mark is centered with `imageWidth: 160` and
`resizeMode: contain`. The pale green (`#eef4f2`) and dark navy (`#07111f`)
backgrounds match the dashboard palette. Android generates density-specific
images and keeps the compact mark inside its splash icon area.

The native splash fades into the first app UI over 450 ms. This uses Expo's native
exit animation on Android and cross-dissolve on iOS, not a second React splash.
There is no minimum display timer. The splash stays visible while the saved
theme is read, then hides on the first root layout. Storage failures fall back
to the system theme. Workbook restoration retains its existing dashboard
loading state. Navigation and native root backgrounds follow the selected theme.

Native light/dark splash selection follows the OS before JavaScript starts. If a
user saved the opposite app theme, the fade transitions into that saved theme.
The OS splash cannot read the app's AsyncStorage theme preference.

## Rebuild and verify

Changes to the native splash configuration and image require a new Android/iOS
binary. Restarting Metro or sending an OTA update alone cannot apply them.
For the configured Android production APK:

```sh
eas build --platform android --profile production --clear-cache
```

Expo Go uses its own launch experience and cannot preview this custom native
animation. Development builds may also differ; verify the final appearance with
a release build, as recommended in the
[Expo SDK 54 splash documentation](https://github.com/expo/expo/blob/sdk-54/docs/pages/versions/v54.0.0/sdk/splash-screen.mdx).

Cold-launch the rebuilt app in OS light and dark modes, then with a saved app
theme opposite the OS. Check centering, unclipped edges, the fade, and that the
dashboard appears without a blank frame. Also check reopening with a saved
workbook and navigating to/from the dashboard. No device was connected during
implementation, so these native visual checks remain to be done.

## Splash asset provenance

`assets/images/splash-mark.png` was created with the built-in image generation
tool, using the existing launcher icon as its edit reference. The launcher icon
and adaptive icon settings were preserved. The generated PNG has an alpha
channel and is 1254 × 1254 pixels.

Generation prompt:

> Use case: precise-object-edit. Asset type: transparent PNG native mobile splash mark for the existing Sales Updater business app. Input image 1 is the existing launcher icon, the edit target. Create a simplified splash-only version of this existing identity: retain the recognizable white folded spreadsheet document, emerald green X tile at left, and rising emerald sales arrow/chart. Remove the WhatsApp speech bubble, all text including Sales Updater and the tagline, the large green rounded-square background, white outer background, and decorative shadows. Preserve the source's recognizable spreadsheet/growth motifs and proportions; use crisp restrained flat styling, white document and emerald #047857 with a small #10b981 accent, no glossy effects or gradients. One compact, optically centered mark on a truly transparent square canvas, roughly 80% of canvas width/height, with even transparent padding. No wordmark, no extra symbols, no surrounding badge, no scene or phone mockup. Sharp legible shapes at small native splash size on both pale green #eef4f2 and deep navy #07111f. Return the actual transparent asset.
