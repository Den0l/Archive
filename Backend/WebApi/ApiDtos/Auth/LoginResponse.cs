namespace WebApi.ApiDtos.Auth {
    public class LoginResponse {
		public string JwtToken { get; set; }
		public bool MustChangePassword { get; set; }
	}
}
