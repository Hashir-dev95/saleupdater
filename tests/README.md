# Sales workflow regression checks

Run from the repository root:

```sh
node --test tests/*.test.cjs
npx tsc --noEmit
npm run lint
npx expo export --platform web
```

On Windows PowerShell with script execution disabled, use `npx.cmd` and
`npm.cmd`. `npm run lint -- --no-cache` runs the same lint rules without a cache.

The tests transpile the actual TypeScript services and sales screen in memory.
Only native adapters, storage, network responses, and React rendering are mocked.
Excel validation uses real XLSX files generated and read by the installed SheetJS
library. Screen tests call the actual event handlers with persistent hook state.
They do not replace TypeScript checking or native integration testing.

Before release, test on Android and iOS:

- Select a workbook, restart the app, and load legacy saved metadata.
- Cancel workbook-change confirmation and the document picker; verify the old
  workbook still opens. Try a corrupt file and a failed replacement download.
- Paste supported sales messages, parse, then edit or clear; Update must remain
  disabled until reparsed. Tap Update rapidly and confirm a single server request.
- Perform a real update against the existing upload API and inspect the resulting
  Excel cells. Confirm the success dialog appears after the workbook is saved.
- Android: open in an installed Excel-compatible app, share, export through SAF,
  cancel folder selection, and test missing viewer and provider/permission errors.
- iOS: open/share through the native document share sheet and export with Save to
  Files, including cancellation. A closed share sheet does not prove a file save.
- Confirm action/network failures preserve the saved workbook across restart.
- Check small phones, tablets, keyboard scrolling, large text, and modal actions.

Web export verifies bundling and static rendering. Workbook operations currently
require the native Android/iOS app; successful mocks or web export do not verify
live Excel updates or device permissions.
