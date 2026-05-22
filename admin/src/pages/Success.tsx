import { useNavigate } from 'react-router-dom';
import authBg from '../assets/images/auth-bg.png';
import { Button } from '../components/Button';
import CheckCircleIcon from '../assets/icons/check-circle';

export const Success = () => {
  const navigate = useNavigate();

  const handleSignIn = () => {
    navigate('/signin');
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{
        backgroundImage: `url(${authBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-[rgba(255, 255, 255, 0.07)] backdrop-blur-[10px] rounded-2xl shadow-2xl p-8 border border-gray-700/30">
          <div className="flex flex-col gap-8 items-center">
            {/* Title */}
            <h1 className="text-2xl font-normal text-white tracking-wide text-center">
              Success!
            </h1>

            {/* Success Icon with Concentric Circles */}
            <div className="flex justify-center">
              <div className="relative w-40 h-40">
                {/* Outer circle - largest (160px) */}
                <div className="absolute top-0 left-0 w-40 h-40 rounded-full bg-purple-300/20"></div>
                {/* Middle circle (128px) - offset by 16px */}
                <div className="absolute top-4 left-4 w-32 h-32 rounded-full bg-purple-400/30"></div>
                {/* Inner circle (96px) - offset by 32px */}
                <div className="absolute top-8 left-8 w-24 h-24 rounded-full bg-purple-600/80 flex items-center justify-center">
                  {/* Check circle icon (48px) - centered in inner circle */}
                  <CheckCircleIcon
                    width={48}
                    height={48}
                    color="#ffffff"
                  />
                </div>
              </div>
            </div>

            {/* Success Message */}
            <p className="text-sm text-white text-center font-normal">
              Your password has been reset.
            </p>

            {/* Sign In Button */}
            <Button type="button" onClick={handleSignIn} fullWidth>
              Sign In
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

