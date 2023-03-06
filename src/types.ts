export interface User {
  id: string;
  name: string;
  screen_name: string;
  profile_image_url: string;
}

export interface Tweet {
  id: string;
  text: string;
  user: User;
  created_at: string;
}
