import React from 'react';
import { ButtonSleek } from '@resomix/ui';

interface Props {
   isAuthenticated: boolean;
   connectLoading: boolean;
   transferLoading: boolean;
   message: string | null;
   error: string | null;
   playlistId: string | null;

   onConnect: () => void;
   onTransfer: () => void;
   onDisconnect: () => void;
}

const AppleExportPanel: React.FC<Props> = ({
   isAuthenticated,
   connectLoading,
   transferLoading,
   message,
   error,
   onConnect,
   onTransfer,
   onDisconnect,
   playlistId,
}) => {
   return (
     <div className="w-full flex flex-col gap-[var(--px-10)] mt-[var(--px-12)]">
       <div className="flex items-center gap-[var(--px-8)] flex-wrap">
         {!isAuthenticated ? (
           <ButtonSleek
             text={connectLoading ? 'Connecting...' : 'Connect to Apple Music'}
             onClick={onConnect}
             disabled={connectLoading}
             className="cta-button primary"
             id="playlist-export-spotify-connect"
           />
         ) : (
           <>
             <ButtonSleek
               text={transferLoading ? 'Transferring...' : 'Transfer to Apple Music'}
               onClick={onTransfer}
               disabled={transferLoading || !playlistId?.trim()}
               className="cta-button primary"
               id="playlist-export-spotify-transfer"
             />
             <ButtonSleek
               text="Disconnect"
               onClick={onDisconnect}
               transparent
               className="cta-button secondary"
               id="playlist-export-spotify-disconnect"
             />
           </>
         )}
       </div>

       <div className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)]">
         Status: {isAuthenticated ? 'Connected ✅' : 'Not Connected ❌'}
       </div>
       {message && (
         <a
           href={message}
           target={'_blank'}
           className="block text-sm font-light font-fira leading-tight text-green-400 whitespace-nowrap overflow-hidden text-ellipsis max-w-full hover:text-green-300 transition-colors"
           title={message}
         >
           {message}
         </a>
       )}
       {error && (
         <div className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] text-red-400">
           {error}
         </div>
       )}
     </div>
   );
};

export default AppleExportPanel;