import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Bell, Mail } from 'lucide-react';

interface CalledNotificationProps {
  queueTitle: string;
  adminName: string;
  adminEmail: string;
  onClose: () => void;
}

export default function CalledNotification({ queueTitle, adminName, adminEmail, onClose }: CalledNotificationProps) {
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 minutes in seconds

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onClose]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 100, y: 20, scale: 0.9 }}
        animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
        exit={{ opacity: 0, x: 100, y: 20, scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed top-4 right-4 z-50 w-full max-w-md"
      >
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 rounded-xl shadow-2xl border border-white/20">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <div className="bg-white/20 p-2 rounded-full">
                <Bell className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">You're Being Called!</h3>
                <p className="text-white/90 text-sm mb-2">
                  <span className="font-medium">{adminName}</span> is calling you for <span className="font-medium">{queueTitle}</span>
                </p>
                <p className="text-white/80 text-xs mb-2">
                  <Mail className="w-3 h-3 inline mr-1" />
                  Contact: {adminEmail}
                </p>
                <div className="flex items-center gap-2 text-white/80 text-sm">
                  <Clock className="w-4 h-4" />
                  <span>Time remaining: {formatTime(timeLeft)}</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="bg-white/20 hover:bg-white/30 p-1 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          {/* Progress bar */}
          <div className="mt-3 bg-white/20 rounded-full h-2 overflow-hidden">
            <motion.div
              initial={{ width: '100%' }}
              animate={{ width: `${(timeLeft / (15 * 60)) * 100}%` }}
              transition={{ duration: 1, ease: 'linear' }}
              className="bg-white h-full rounded-full"
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
