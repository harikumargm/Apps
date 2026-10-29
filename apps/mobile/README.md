# Sai Cotton Vastram Store

Flutter client for the shop. Riverpod holds shop and bag state. GetIt provides the API client and repository.

```bash
flutter pub get
flutter run --dart-define=API_URL=http://127.0.0.1:8000
```

Android emulator: `--dart-define=API_URL=http://10.0.2.2:8000`.

The home weave is a fragment shader (`shaders/weave.frag`) with a canvas fallback. Trial-View calls `POST /v1/tryon/twin` and requires the consent checkbox.
