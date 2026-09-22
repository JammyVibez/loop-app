"use client";
import { useToast } from "@/hooks/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastIcon,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

/**
 * The app's single notification surface. Every `toast()` call in the codebase
 * lands here, so success, error, warning and info all look and behave the same.
 */
export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider swipeDirection="right">
      {toasts?.map(function ({ id, title, description, action, variant, icon, ...props }) {
        return (
          <Toast key={id} variant={variant} {...props}>
            <ToastIcon variant={variant} icon={icon} />
            <div className="grid min-w-0 flex-1 gap-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
