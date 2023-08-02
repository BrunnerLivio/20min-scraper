export interface Comment {
  id: number;
  author: string | null;
  createdAt: string | null;
  content: string | null;
  reactions_quatsch: number;
  reactions_unnoetig: number;
  reactions_genau: number;
  reactions_love_it: number;
  reactions_smart: number;
  reactions_so_nicht: number;
  subComments?: Comment[];
}
