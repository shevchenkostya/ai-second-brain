import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from config import settings


def _send(to: str, subject: str, html: str) -> None:
    if not settings.smtp_host:
        # Dev mode — print to stdout instead of sending
        print(f"[EMAIL] To: {to} | Subject: {subject}")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.from_email
    msg["To"] = to
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as smtp:
        smtp.ehlo()
        smtp.starttls()
        smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.sendmail(settings.from_email, to, msg.as_string())


def send_verification_email(to: str, token: str) -> None:
    link = f"{settings.frontend_url}/verify-email?token={token}"
    _send(
        to=to,
        subject="Confirm your email — AI Second Brain",
        html=f"""
        <p>Hi,</p>
        <p>Click the link below to verify your email address:</p>
        <p><a href="{link}">{link}</a></p>
        <p>The link expires in {settings.email_token_expire_hours} hours.</p>
        """,
    )


def send_password_reset_email(to: str, token: str) -> None:
    link = f"{settings.frontend_url}/reset-password?token={token}"
    _send(
        to=to,
        subject="Reset your password — AI Second Brain",
        html=f"""
        <p>Hi,</p>
        <p>Click the link below to reset your password:</p>
        <p><a href="{link}">{link}</a></p>
        <p>The link expires in {settings.email_token_expire_hours} hours.</p>
        <p>If you did not request a password reset, ignore this email.</p>
        """,
    )
