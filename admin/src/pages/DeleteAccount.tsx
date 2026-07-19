import { useState } from 'react';
import authBg from '../assets/images/auth-bg.png';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import CheckCircleIcon from '../assets/icons/check-circle';

const SUPPORT_EMAIL = 'nevermoreapp@gmail.com';

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const DeleteAccount = () => {
  const [email, setEmail] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidEmail(email.trim())) {
      setError('Please enter the email address associated with your account.');
      return;
    }

    setError('');

    const subject = 'Account Deletion Request';
    const body = [
      `Account email: ${email.trim()}`,
      '',
      'Additional details:',
      details.trim() || '(none provided)',
    ].join('\n');

    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSubmitted(true);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden py-12"
      style={{
        backgroundImage: `url(${authBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-[rgba(255,255,255,0.07)] backdrop-blur-[10px] rounded-2xl shadow-2xl p-8 border border-gray-700/30">
          {!submitted ? (
            <>
              <h1 className="text-2xl font-normal text-white mb-4 tracking-wide text-center">
                Delete Your Account
              </h1>

              <p className="text-sm text-gray-300 mb-4 text-center">
                If you have access to the app, the fastest way to delete your account is in-app:
                {' '}
                <span className="text-white">Profile → Delete Account</span>.
              </p>

              <p className="text-sm text-gray-300 mb-8 text-center">
                No app access? Submit a request below and we'll delete your account and associated
                data manually. Deleting your account permanently removes your profile, journey
                progress, and any personal data tied to it — this cannot be undone. Requests are
                processed within 30 days.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input
                  type="email"
                  label="Account email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <div>
                  <label htmlFor="details" className="block text-white text-sm font-normal mb-2">
                    Additional details (optional)
                  </label>
                  <textarea
                    id="details"
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 bg-[#131313] border border-[rgba(255,255,255,0.25)] rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition resize-none"
                    placeholder="Anything that helps us find your account"
                  />
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
                    <p className="text-red-400 text-sm text-center">{error}</p>
                  </div>
                )}

                <Button type="submit" fullWidth>
                  Request Deletion
                </Button>
              </form>
            </>
          ) : (
            <div className="flex flex-col gap-8 items-center">
              <h1 className="text-2xl font-normal text-white tracking-wide text-center">
                Request Sent
              </h1>

              <div className="relative w-40 h-40">
                <div className="absolute top-0 left-0 w-40 h-40 rounded-full bg-purple-300/20" />
                <div className="absolute top-4 left-4 w-32 h-32 rounded-full bg-purple-400/30" />
                <div className="absolute top-8 left-8 w-24 h-24 rounded-full bg-purple-600/80 flex items-center justify-center">
                  <CheckCircleIcon width={48} height={48} color="#ffffff" />
                </div>
              </div>

              <p className="text-sm text-white text-center font-normal">
                Your email app should have opened with your request pre-filled to{' '}
                <span className="text-[#9D5DD1]">{SUPPORT_EMAIL}</span>. If it didn't, please
                email us directly at that address with your account email to request deletion.
                We'll confirm once it's been processed.
              </p>

              <Button
                type="button"
                variant="outline"
                fullWidth
                onClick={() => setSubmitted(false)}
              >
                Back
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
