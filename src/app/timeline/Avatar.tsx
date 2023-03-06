/* eslint-disable @next/next/no-img-element */

import { User } from "@/types";

export interface AvatarProps {
  user: User;
}

export const Avatar: React.FC<AvatarProps> = ({ user }) => {
  return (
    <span className="rounded-full bg-gray-400 w-12 h-12">
      <img
        src={user.profile_image_url}
        className="w-full h-full object-cover rounded-full"
        alt={`@${user.screen_name} ${user.name}`}
        loading="lazy"
      />
    </span>
  );
};
