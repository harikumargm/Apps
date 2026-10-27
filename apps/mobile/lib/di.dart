import "package:get_it/get_it.dart";

import "data/repositories/shop_repository.dart";
import "data/services/api_client.dart";

final getIt = GetIt.instance;

void setupDependencies({String? apiUrl}) {
  if (getIt.isRegistered<ApiClient>()) return;
  const fromEnv = String.fromEnvironment("API_URL", defaultValue: "http://127.0.0.1:8000");
  final client = ApiClient(baseUrl: apiUrl ?? fromEnv);
  getIt.registerSingleton<ApiClient>(client);
  getIt.registerSingleton<ShopRepository>(ShopRepository(client));
}
