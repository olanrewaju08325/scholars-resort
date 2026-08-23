import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950/50 pb-20">
      {/* Header Skeleton */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between">
        <Skeleton className="h-7 w-40" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
      </header>

      <div className="container max-w-7xl mx-auto p-4 space-y-6 mt-4">
        {/* Welcome Hero Skeleton */}
        <Card className="border-border bg-card/60 overflow-hidden">
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-3 flex-1">
                <Skeleton className="h-4 w-28 rounded-full" />
                <Skeleton className="h-8 w-64 md:w-80" />
                <Skeleton className="h-4 w-48 md:w-96" />
                <div className="flex gap-3 pt-2">
                  <Skeleton className="h-9 w-32 rounded-xl" />
                  <Skeleton className="h-9 w-32 rounded-xl" />
                </div>
              </div>
              <div className="flex gap-4">
                <Skeleton className="h-24 w-28 rounded-2xl" />
                <Skeleton className="h-24 w-28 rounded-2xl" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tip & Score Predictor Skeletons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>

        {/* Two Column Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Column (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Daily Goal Skeleton */}
            <Card className="border-border bg-card/60 p-6 rounded-2xl space-y-4">
              <div className="flex justify-between items-center">
                <Skeleton className="h-6 w-44" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-3 w-full rounded-full" />
              <div className="grid grid-cols-3 gap-3 pt-2">
                <Skeleton className="h-14 rounded-xl" />
                <Skeleton className="h-14 rounded-xl" />
                <Skeleton className="h-14 rounded-xl" />
              </div>
            </Card>

            {/* Quick Actions Skeleton */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
            </div>

            {/* Stats Overview Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
            </div>

            {/* Performance Trend Chart Skeleton */}
            <Card className="border-border bg-card/60 p-6 rounded-2xl space-y-4">
              <div className="flex justify-between items-center">
                <Skeleton className="h-6 w-52" />
                <Skeleton className="h-8 w-24 rounded-lg" />
              </div>
              <Skeleton className="h-60 w-full rounded-xl" />
            </Card>

            {/* Subject Mastery Radar Skeleton */}
            <Card className="border-border bg-card/60 p-6 rounded-2xl space-y-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-56 w-full rounded-xl" />
            </Card>
          </div>

          {/* Right Column (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* JAMB Countdown Skeleton */}
            <Card className="border-border bg-card/60 p-6 rounded-2xl space-y-3">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </Card>

            {/* XP & Level Skeleton */}
            <Card className="border-border bg-card/60 p-6 rounded-2xl space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </Card>

            {/* Study Streak Calendar Skeleton */}
            <Card className="border-border bg-card/60 p-6 rounded-2xl space-y-3">
              <Skeleton className="h-5 w-32" />
              <div className="grid grid-cols-7 gap-2 pt-2">
                {Array.from({ length: 14 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-8 rounded-lg" />
                ))}
              </div>
            </Card>

            {/* Leaderboard Preview Skeleton */}
            <Card className="border-border bg-card/60 p-6 rounded-2xl space-y-3">
              <Skeleton className="h-5 w-40 mb-2" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border/40">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-7 w-7 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
