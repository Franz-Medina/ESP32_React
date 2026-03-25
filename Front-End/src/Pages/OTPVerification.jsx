import { useEffect, useMemo, useRef, useState } from 'react'
import logo from '../Pictures/Avinya.png'
import '../Styles/OTPVerification.css'
import { ErrorIcon } from '../Components/LoginIcons.jsx'

import { API_URL } from '../Config/API'

const OTP_CODE_REGEX = /^[A-Z0-9]{6}$/

const getOtpValidationError = (value) => {
  if (!value) {
    return 'Please enter the 6-character verification code.'
  }

  if (value.length !== 6) {
    return 'Verification code must be exactly 6 characters.'
  }

  if (!OTP_CODE_REGEX.test(value)) {
    return 'Verification code must contain letters and numbers only.'
  }

  return ''
}

function OTPVerification({ verificationEmail, onGoToLogin, onGoToRegister }) {
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', ''])
  const [otpError, setOtpError] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const inputRefs = useRef([])

  const getRemainingSeconds = () => {
    const storedExpiry = sessionStorage.getItem('avinya-otp-expiry-at')

    if (!storedExpiry) return 0

    const differenceInMs = new Date(storedExpiry).getTime() - Date.now()
    return Math.max(Math.ceil(differenceInMs / 1000), 0)
  }

  const [secondsLeft, setSecondsLeft] = useState(getRemainingSeconds)

  useEffect(() => {
    document.title = 'Avinya | OTP Verification'
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft(getRemainingSeconds())
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  const maskedEmail = useMemo(() => {
    if (!verificationEmail) return 'your email address'

    const [localPart, domainPart] = verificationEmail.split('@')

    if (!localPart || !domainPart) return verificationEmail
    if (localPart.length <= 2) return `${localPart[0] || ''}*@${domainPart}`

    return `${localPart.slice(0, 2)}${'*'.repeat(Math.max(localPart.length - 2, 2))}@${domainPart}`
  }, [verificationEmail])

  const formattedTimer = useMemo(() => {
    const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
    const seconds = String(secondsLeft % 60).padStart(2, '0')
    return `${minutes}:${seconds}`
  }, [secondsLeft])

  const clearOtpFeedback = () => {
    if (otpError) setOtpError('')
  }

  const handleOtpChange = (value, index) => {
    const sanitizedValue = value.replace(/[^a-zA-Z0-9]/g, '').slice(-1).toUpperCase()
    const nextValues = [...otpValues]

    nextValues[index] = sanitizedValue
    setOtpValues(nextValues)
    clearOtpFeedback()

    if (sanitizedValue && index < otpValues.length - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (event, index) => {
    if (event.key === 'Backspace' && !otpValues[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }

    if (event.key === 'ArrowRight' && index < otpValues.length - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpPaste = (event) => {
    event.preventDefault()

    const pastedValue = event.clipboardData
      .getData('text')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 6)
      .toUpperCase()

    if (!pastedValue) return

    const nextValues = ['', '', '', '', '', '']

    pastedValue.split('').forEach((character, index) => {
      nextValues[index] = character
    })

    setOtpValues(nextValues)
    clearOtpFeedback()

    inputRefs.current[Math.min(pastedValue.length, 6) - 1]?.focus()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const otpCode = otpValues.join('').trim().toUpperCase()
    const otpValidationError = getOtpValidationError(otpCode)

    if (!verificationEmail) {
      setOtpError('No pending verification email was found. Please register again.')
      return
    }

    if (otpValidationError) {
      setOtpError(otpValidationError)
      return
    }

    try {
      setIsVerifying(true)
      setOtpError('')

      const response = await fetch(`${API_URL}/otp/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: verificationEmail,
          code: otpCode
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong while verifying your code. Please try again.')
      }

      sessionStorage.removeItem('avinya-otp-expiry-at')

      if (onGoToLogin) {
        onGoToLogin()
      }
    } catch (error) {
      const message = error?.message || ''

      if (error instanceof TypeError || message === 'Failed to fetch') {
        setOtpError('Unable to connect to the server. Please check your internet connection and try again.')
      } else if (/already present in database/i.test(message)) {
        setOtpError('This email already exists in ThingsBoard Cloud from an earlier failed attempt. Delete the old ThingsBoard user first, then verify again.')
      } else if (/invalid uuid string: users/i.test(message)) {
        setOtpError('The ThingsBoard tenant user lookup path is invalid in the backend. Please restart the backend after applying the Index.js fix.')
      } else {
        setOtpError(message || 'Something went wrong while verifying your code. Please try again.')
      }
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResendCode = async () => {
    if (!verificationEmail) {
      setOtpError('No pending verification email was found. Please register again.')
      return
    }

    if (secondsLeft > 0) {
      return
    }

    try {
      setIsResending(true)
      setOtpError('')

      const response = await fetch(`${API_URL}/otp/resend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: verificationEmail
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong while resending the verification code. Please try again.')
      }

      setOtpValues(['', '', '', '', '', ''])

      if (data.otpExpiresAt) {
        sessionStorage.setItem('avinya-otp-expiry-at', data.otpExpiresAt)
        setSecondsLeft(getRemainingSeconds())
      }

      inputRefs.current[0]?.focus()
    } catch (error) {
      if (error instanceof TypeError || error.message === 'Failed to fetch') {
        setOtpError('Unable to connect to the server. Please check your internet connection and try again.')
      } else {
        setOtpError(error.message || 'Something went wrong while resending the verification code. Please try again.')
      }
    } finally {
      setIsResending(false)
    }
  }

  const cleanupPendingAccount = async () => {
    if (!verificationEmail) return

    try {
      await fetch(`${API_URL}/otp/pending-user`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: verificationEmail
        })
      })
    } catch {
    } finally {
      sessionStorage.removeItem('avinya-otp-expiry-at')
    }
  }

  const handleLoginClick = async () => {
    setIsLeaving(true)
    await cleanupPendingAccount()
    setIsLeaving(false)

    if (onGoToLogin) {
      onGoToLogin()
    }
  }

  const handleRegisterClick = async () => {
    setIsLeaving(true)
    await cleanupPendingAccount()
    setIsLeaving(false)

    if (onGoToRegister) {
      onGoToRegister()
    }
  }

  const hasOtpFieldError = Boolean(otpError)

  return (
    <main className="login-page">
      <div className="login-left"></div>

      <section className="login-right">
        <div className="login-right-content">
          <img src={logo} alt="Avinya Logo" className="login-logo img-fluid" />

          <div className="login-text-group">
            <h1 className="login-title">AVINYA</h1>
            <p className="login-text">
              Enter the 6-character code to continue setting up your account.
            </p>
          </div>

          <p className="otp-helper-text">
            We sent a verification code to{' '}
            <span className="otp-helper-email">{maskedEmail}</span>.
          </p>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="otp-code-group">
              <div className="otp-code-row" onPaste={handleOtpPaste}>
                {otpValues.map((value, index) => (
                  <input
                    key={index}
                    ref={(element) => {
                      inputRefs.current[index] = element
                    }}
                    type="text"
                    inputMode="text"
                    maxLength={1}
                    className={`otp-code-input ${hasOtpFieldError ? 'otp-code-input-error' : ''}`}
                    value={value}
                    onChange={(event) => handleOtpChange(event.target.value, index)}
                    onKeyDown={(event) => handleOtpKeyDown(event, index)}
                    aria-label={`OTP character ${index + 1}`}
                    aria-invalid={hasOtpFieldError}
                    autoComplete="one-time-code"
                  />
                ))}
              </div>

              {otpError && (
                <div className="login-error-row otp-error-row">
                  <span className="login-error-icon" aria-hidden="true">
                    <ErrorIcon />
                  </span>
                  <span>{otpError}</span>
                </div>
              )}
            </div>

            <div className="otp-resend-row">
              <span className="otp-resend-text">
                {secondsLeft > 0
                  ? `Code expires in ${formattedTimer}`
                  : 'Didn’t receive the code?'}
              </span>

              <button
                type="button"
                className="otp-resend-button"
                onClick={handleResendCode}
                disabled={secondsLeft > 0 || isResending || isVerifying || isLeaving}
              >
                {isResending ? 'Sending...' : 'Resend Code'}
              </button>
            </div>

            <button
              type="submit"
              className="login-button"
              disabled={isVerifying || isResending || isLeaving}
            >
              {isVerifying ? (
                <span className="login-button-loading">
                  <span className="login-spinner"></span>
                  <span>Verifying Code</span>
                </span>
              ) : (
                'Verify Code'
              )}
            </button>

            <div className="login-register-row otp-secondary-row">
              <span className="login-register-text">Wrong email?</span>
              <button
                type="button"
                className="login-register-link"
                onClick={handleRegisterClick}
                disabled={isLeaving || isVerifying || isResending}
              >
                Register Again
              </button>
            </div>

            <div className="login-register-row">
              <span className="login-register-text">Already have an account?</span>
              <button
                type="button"
                className="login-register-link"
                onClick={handleLoginClick}
                disabled={isLeaving || isVerifying || isResending}
              >
                Login
              </button>
            </div>
          </form>

          <div className="login-powered">
            <img src={logo} alt="Avinya Logo" className="login-powered-logo img-fluid" />
            <span>
              Powered by <span className="login-powered-brand">AVINYA</span>
            </span>
          </div>
        </div>
      </section>
    </main>
  )
}

export default OTPVerification