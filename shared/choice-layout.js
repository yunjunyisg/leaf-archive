// Screen-space layout for the taxonomy popup. The caller supplies the visible dialog bounds.
export function choicePanelLayout(anchor,frame,preferredHeight=260,preferredWidth=300){
 const gap=6,roomWidth=Math.max(1,frame.right-frame.left),roomHeight=Math.max(1,frame.bottom-frame.top),width=Math.min(roomWidth,Math.max(anchor.right-anchor.left,preferredWidth));
 const left=Math.max(frame.left,Math.min(anchor.left,frame.right-width)),below=frame.bottom-anchor.bottom-gap,above=anchor.top-frame.top-gap;
 let placement=below>=preferredHeight?'below':above>below?'above':'below',space=Math.max(0,placement==='above'?above:below);
 if(space<112){placement='overlay';space=roomHeight}
 const maxHeight=Math.max(1,Math.min(preferredHeight,space,roomHeight));
 const wanted=placement==='above'?anchor.top-gap-maxHeight:anchor.bottom+gap,top=Math.max(frame.top,Math.min(wanted,frame.bottom-maxHeight));
 return {left,top,width,maxHeight,placement};
}
