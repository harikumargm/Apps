import "dart:convert";

import "package:http/http.dart" as http;

class ApiException implements Exception {
  ApiException(this.status, this.message);
  final int status;
  final String message;

  @override
  String toString() => message;
}

class ApiClient {
  ApiClient({required this.baseUrl, http.Client? httpClient}) : _http = httpClient ?? http.Client();

  final String baseUrl;
  final http.Client _http;
  String? token;
  String sessionId = "mobile-${DateTime.now().millisecondsSinceEpoch}";

  Map<String, String> get _headers => {
        "Content-Type": "application/json",
        "X-Session-Id": sessionId,
        if (token != null) "Authorization": "Bearer $token",
      };

  Future<Map<String, dynamic>> getJson(String path) async {
    final response = await _http.get(Uri.parse("$baseUrl$path"), headers: _headers);
    return _decode(response);
  }

  Future<Map<String, dynamic>> send(String path, {required String method, Object? body}) async {
    final response = await _http.sendRequest(method, Uri.parse("$baseUrl$path"), headers: _headers, body: body == null ? null : jsonEncode(body));
    return _decode(response);
  }

  Map<String, dynamic> _decode(http.Response response) {
    final data = response.body.isEmpty ? <String, dynamic>{} : jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode >= 400) {
      throw ApiException(response.statusCode, (data["detail"] as String?) ?? "Request failed");
    }
    return data;
  }
}

extension on http.Client {
  Future<http.Response> sendRequest(String method, Uri uri, {Map<String, String>? headers, Object? body}) {
    switch (method) {
      case "POST":
        return post(uri, headers: headers, body: body);
      case "PUT":
        return put(uri, headers: headers, body: body);
      case "PATCH":
        return patch(uri, headers: headers, body: body);
      case "DELETE":
        return delete(uri, headers: headers, body: body);
      default:
        return get(uri, headers: headers);
    }
  }
}
