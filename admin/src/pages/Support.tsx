import { useState } from 'react';
import authBg from '../assets/images/auth-bg.png';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import CheckCircleIcon from '../assets/icons/check-circle';

const SUPPORT_EMAIL = 'nevermoreapp@gmail.com';

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const Support = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidEmail(email.trim())) {
      setError('Please enter a valid email address so we can get back to you.');
      return;
    }

    if (!message.trim()) {
      setError('Please describe what you need help with.');
      return;
    }

    setError('');

    const subject = 'Nevermore Support Request';
    const body = [
      `From: ${email.trim()}`,
      '',
      message.trim(),
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
                Contact Support
              </h1>

              <p className="text-sm text-gray-300 mb-8 text-center">
                Have a question, found a bug, or need help with your account? Send us a
                message below and we'll get back to you as soon as we can. You can also
                reach us directly at{' '}
                <span className="text-[#9D5DD1]">{SUPPORT_EMAIL}</span>.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input
                  type="email"
                  label="Your email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <div>
                  <label htmlFor="message" className="block text-white text-sm font-normal mb-2">
                    How can we help?
                  </label>
                  <textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    className="w-full px-4 py-3 bg-[#131313] border border-[rgba(255,255,255,0.25)] rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition resize-none"
                    placeholder="Describe your issue or question"
                  />
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
                    <p className="text-red-400 text-sm text-center">{error}</p>
                  </div>
                )}

                <Button type="submit" fullWidth>
                  Send Message
                </Button>
              </form>
            </>
          ) : (
            <div className="flex flex-col gap-8 items-center">
              <h1 className="text-2xl font-normal text-white tracking-wide text-center">
                Message Sent
              </h1>

              <div className="relative w-40 h-40">
                <div className="absolute top-0 left-0 w-40 h-40 rounded-full bg-purple-300/20" />
                <div className="absolute top-4 left-4 w-32 h-32 rounded-full bg-purple-400/30" />
                <div className="absolute top-8 left-8 w-24 h-24 rounded-full bg-purple-600/80 flex items-center justify-center">
                  <CheckCircleIcon width={48} height={48} color="#ffffff" />
                </div>
              </div>

              <p className="text-sm text-white text-center font-normal">
                Your email app should have opened with your message pre-filled to{' '}
                <span className="text-[#9D5DD1]">{SUPPORT_EMAIL}</span>. If it didn't,
                please email us directly at that address and we'll get back to you soon.
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
