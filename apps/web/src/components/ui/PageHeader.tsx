import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actions }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E9E9E7] dark:border-[#2F2F2F]">
    <div>
      <h2 className="text-lg font-semibold tracking-tight text-[#2C2B28] dark:text-white">
        {title}
      </h2>
      {subtitle && (
        <p className="text-xs text-[#787774] dark:text-[#9B9A97] mt-0.5 max-w-3xl">{subtitle}</p>
      )}
    </div>
    {actions && <div className="flex items-center space-x-2">{actions}</div>}
  </div>
);

interface SectionBannerProps {
  tone: 'amber' | 'blue' | 'green';
  title: string;
  children: React.ReactNode;
}

export const SectionBanner: React.FC<SectionBannerProps> = () => null;
