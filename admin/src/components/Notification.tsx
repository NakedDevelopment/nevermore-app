import { useNotificationStore } from '../store/notificationStore';
import CloseIcon from '../assets/icons/close';

interface NotificationProps {
  notification: {
    id: string;
    message: string;
    type: 'error' | 'success' | 'info' | 'warning';
    duration?: number;
  };
}

export const NotificationItem = ({ notification }: NotificationProps) => {
  const { removeNotification } = useNotificationStore();

  const handleClose = () => {
    removeNotification(notification.id);
  };

  // Get icon and color based on type
  const getNotificationStyles = () => {
    switch (notification.type) {
      case 'error':
        return {
          bg: 'bg-red-50 border-red-300',
          text: 'text-red-900',
          iconBg: 'bg-red-100',
          icon: '✕',
        };
      case 'success':
        return {
          bg: 'bg-green-50 border-green-300',
          text: 'text-green-900',
          iconBg: 'bg-green-100',
          icon: '✓',
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50 border-yellow-300',
          text: 'text-yellow-900',
          iconBg: 'bg-yellow-100',
          icon: '⚠',
        };
      case 'info':
        return {
          bg: 'bg-blue-50 border-blue-300',
          text: 'text-blue-900',
          iconBg: 'bg-blue-100',
          icon: 'ℹ',
        };
      default:
        return {
          bg: 'bg-gray-50 border-gray-300',
          text: 'text-gray-900',
          iconBg: 'bg-gray-100',
          icon: 'ℹ',
        };
    }
  };

  const styles = getNotificationStyles();

  return (
    <div
      className={`
        ${styles.bg} ${styles.text}
        border rounded-lg shadow-md
        px-4 py-3 pr-10
        min-w-[320px] max-w-[500px]
        flex items-start gap-3
        relative
      `}
      role="alert"
      style={{
        animation: 'slideInRight 0.3s ease-out',
      }}
    >
      <div className={`${styles.iconBg} rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5`}>
        <span className="text-xs font-bold">{styles.icon}</span>
      </div>
      <p className="flex-1 text-sm font-medium leading-relaxed">
        {notification.message}
      </p>
      <button
        onClick={handleClose}
        className={`
          absolute top-2.5 right-2.5
          ${styles.text} opacity-50 hover:opacity-100
          transition-opacity duration-200
          p-0.5 rounded hover:bg-black/10
          flex items-center justify-center
        `}
        aria-label="Close notification"
      >
        <CloseIcon width={14} height={14} className={styles.text} />
      </button>
    </div>
  );
};

export const NotificationContainer = () => {
  const { notifications } = useNotificationStore();

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div
      className="
        fixed top-4 right-4 z-50
        flex flex-col gap-3
        pointer-events-none
      "
    >
      {notifications.map((notification) => (
        <div key={notification.id} className="pointer-events-auto">
          <NotificationItem notification={notification} />
        </div>
      ))}
    </div>
  );
};

