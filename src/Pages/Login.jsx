import logo from '../Pictures/Avinya.png'

function Login() {
  return (
    <div className="login-page">
      <div className="login-left"></div>

      <div className="login-right">
        <div className="login-right-content">
          <img src={logo} alt="Avinya Logo" className="login-logo img-fluid" />

          <div className="login-text-group">
            <h1 className="login-title">AVINYA</h1>
            <p className="login-text">
              Please provide your login details to securely access your account.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login