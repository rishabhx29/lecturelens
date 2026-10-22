import { format } from "date-fns";

export function getDateTime(date: string): string {
  return format(new Date(date), "MMM d, yyyy '·' h:mm a");
}

export function getShortDate(date: string): string {
  return format(new Date(date), "MMM d, yyyy");
}
