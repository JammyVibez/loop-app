"use client";
import React from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader } from './ui/card';

// Generic loading spinner
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4 stroke-[2.5]',
    md: 'h-5 w-5 stroke-[2.5]',
    lg: 'h-8 w-8 stroke-[2.5]'
  }

  return (
    <Loader2 
      className={cn('animate-spin text-primary opacity-80', sizeClasses[size], className)} 
    />
  )
}

// Full page loading screen
interface PageLoadingProps {
  message?: string
}

export function PageLoading({ message = 'Loading' }: PageLoadingProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground transition-colors">
      <div className="text-center space-y-4 max-w-xs px-4">
        <div className="relative mx-auto w-12 h-12 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
          <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <div className="h-3 w-3 rounded-full bg-primary/80 animate-pulse" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium tracking-wide text-foreground/90">
            {message}
          </p>
          <div className="h-0.5 w-16 mx-auto bg-primary/20 overflow-hidden rounded-full">
            <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

// Button loading state
interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  children: React.ReactNode
}

export function LoadingButton({ loading, children, disabled, className, ...props }: LoadingButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        'bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2',
        className
      )}
      disabled={loading || disabled}
      {...props}
    >
      {loading && <LoadingSpinner size="sm" />}
      {children}
    </button>
  )
}

// Skeleton loading components
export function SkeletonLine({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse bg-muted rounded h-4', className)} />
  )
}

export function SkeletonAvatar({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse bg-muted rounded-full h-10 w-10', className)} />
  )
}

export function SkeletonCard() {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center space-x-3">
          <SkeletonAvatar />
          <div className="space-y-2 flex-1">
            <SkeletonLine className="w-1/4" />
            <SkeletonLine className="w-1/6" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <SkeletonLine className="w-full" />
        <SkeletonLine className="w-3/4" />
        <SkeletonLine className="w-1/2" />
        <div className="flex items-center justify-between pt-4">
          <div className="flex space-x-4">
            <SkeletonLine className="w-12 h-6" />
            <SkeletonLine className="w-12 h-6" />
            <SkeletonLine className="w-12 h-6" />
          </div>
          <SkeletonLine className="w-16 h-6" />
        </div>
      </CardContent>
    </Card>
  )
}

// Loop feed skeleton
export function LoopFeedSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

// Profile skeleton
export function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="animate-pulse bg-muted rounded-lg h-48" />
      
      {/* Profile info */}
      <div className="flex items-start space-x-4 -mt-16 relative z-10 px-6">
        <SkeletonAvatar className="h-24 w-24 border-4 border-background" />
        <div className="flex-1 space-y-3 pt-12">
          <SkeletonLine className="w-1/3 h-6" />
          <SkeletonLine className="w-1/4" />
          <SkeletonLine className="w-full" />
          <SkeletonLine className="w-3/4" />
          
          <div className="flex space-x-6 pt-4">
            <SkeletonLine className="w-20" />
            <SkeletonLine className="w-20" />
            <SkeletonLine className="w-20" />
          </div>
        </div>
      </div>
    </div>
  )
}

// Message skeleton
export function MessageSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={cn('flex space-x-3', i % 2 === 0 ? 'justify-start' : 'justify-end')}>
          {i % 2 === 0 && <SkeletonAvatar className="h-8 w-8" />}
          <div className={cn('space-y-1', i % 2 === 0 ? 'max-w-xs' : 'max-w-xs')}>
            <SkeletonLine className={cn('h-8', i % 2 === 0 ? 'w-32' : 'w-24')} />
            <SkeletonLine className="w-16 h-3" />
          </div>
          {i % 2 === 1 && <SkeletonAvatar className="h-8 w-8" />}
        </div>
      ))}
    </div>
  )
}

// Loading overlay for components
interface LoadingOverlayProps {
  loading: boolean
  children: React.ReactNode
  message?: string
}

export function LoadingOverlay({ loading, children, message = 'Loading...' }: LoadingOverlayProps) {
  return (
    <div className="relative">
      {children}
      {loading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center space-y-2">
            <LoadingSpinner size="lg" />
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// Infinite scroll loading
export function InfiniteScrollLoading() {
  return (
    <div className="flex justify-center py-8">
      <div className="flex items-center space-x-2 text-muted-foreground">
        <LoadingSpinner size="sm" />
        <span className="text-sm">Loading more...</span>
      </div>
    </div>
  )
}

// Empty state component
interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      {icon && (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && (
        <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-6">
          {action}
        </div>
      )}
    </div>
  )
}
