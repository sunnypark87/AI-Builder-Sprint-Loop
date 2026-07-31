'use client';

import Link from 'next/link';

import { buttonClassName } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function PublishConfirmation({
  triggerLabel,
  title,
  description,
  confirmLabel,
  href,
}: {
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  href: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className={buttonClassName()} type="button">
          {triggerLabel}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="mt-2 leading-6">
          {description}
        </DialogDescription>
        <DialogFooter>
          <DialogClose asChild>
            <button
              className={buttonClassName({ variant: 'secondary' })}
              type="button"
            >
              계속 검토
            </button>
          </DialogClose>
          <Link className={buttonClassName()} href={href}>
            {confirmLabel}
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
