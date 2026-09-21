"use client";

/**
 * Legacy import path.
 *
 * This file used to hold a second, complete copy of the toast store — its own
 * `memoryState`, its own listener list. Only `<Toaster>` (which reads
 * `hooks/use-toast`) is mounted, so every `toast()` fired from a component that
 * imported *this* path wrote into a store nobody rendered: the call returned
 * an id, nothing appeared, and no error was raised. It is now a re-export so
 * both paths are the same notifications.
 */

export { useToast, toast, reducer } from "@/hooks/use-toast";
