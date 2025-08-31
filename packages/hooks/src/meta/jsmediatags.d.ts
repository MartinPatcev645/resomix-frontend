declare module 'jsmediatags/dist/jsmediatags.min.js' {
  interface Picture {
    data: number[];
    format: string;
  }

  interface Tags {
    title?: string | any;
    artist?: string | any;
    album?: string | any;
    year?: string | any;
    genre?: string | any;
    picture?: Picture;
    TIT2?: string | any;
    TT2?: string | any;
    TPE1?: string | any;
    TP1?: string | any;
    TALB?: string | any;
    TAL?: string | any;
    TYER?: string | any;
    TYE?: string | any;
    TDRC?: string | any;
    TDAT?: string | any;
    TCON?: string | any;
    TCO?: string | any;
    TPUB?: string | any;
    TPB?: string | any;
    TBPM?: string | any;
    TBP?: string | any;
    TKEY?: string | any;
    TKE?: string | any;
    TXXX?: any;
    [key: string]: any;
  }

  interface TagResult {
    tags?: Tags;
  }

  interface ReadOptions {
    onSuccess: (tag: TagResult) => void;
    onError: (error: any) => void;
  }

  export function read(file: File, options: ReadOptions): void;
  
  const jsmediatags: {
    read: (file: File, options: ReadOptions) => void;
  };
  export default jsmediatags;
}
