import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';
import { modalBackdrop, modalEnter } from '../../utils/motion';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  const widthClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          variants={modalBackdrop}
          initial="initial"
          animate="animate"
          exit="exit"
          className="fixed inset-0 z-modal flex items-center justify-center p-4 sm:p-6 bg-slate-950/45 backdrop-blur-[4px]"
          onClick={onClose}
        >
          <motion.div
            variants={modalEnter}
            initial="initial"
            animate="animate"
            exit="exit"
            className={`relative w-full ${widthClasses[maxWidth]} rounded-[26px] bg-white dark:bg-[#181C22] border border-slate-200/90 dark:border-[#2B323D] shadow-2xl overflow-hidden flex flex-col max-h-[88vh]`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100 dark:border-[#2B323D]">
              <div>
                <h2 className="text-[17px] sm:text-[18px] font-bold text-slate-900 dark:text-slate-100 font-sans">
                  {title}
                </h2>
                {subtitle && (
                  <p className="text-[12px] sm:text-[13px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>
              <IconButton
                aria-label="Close dialog"
                icon={<X className="w-4 h-4 text-slate-400 hover:text-slate-700 dark:hover:text-white" />}
                size="sm"
                onClick={onClose}
              />
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 overflow-y-auto flex-1 text-[13px] sm:text-[14px] text-slate-600 dark:text-slate-300">
              {children}
            </div>

            {/* Modal Footer */}
            {footer && (
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-[#2B323D] bg-slate-50/70 dark:bg-[#13171C]">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
