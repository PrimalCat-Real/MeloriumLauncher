import { useEffect } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

import classes from './index.module.sass';
import { modalContent, modalShow, modalTitle } from './states';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
  } from "../../../components/ui/dialog"
import { Button } from '../../../components/ui/button';
  
export default function Modal() {
    const [show, setShow] = useRecoilState(modalShow);
    const content = useRecoilValue(modalContent);
    const title = useRecoilValue(modalTitle);

    function closeModal() {
        setShow(false);
    }

    const closeOnEscapeKeyDown = (event: KeyboardEvent) => {
        if (event.code === 'Escape' || event.key === 'Escape') closeModal();
    };

    useEffect(() => {
        document.addEventListener('keydown', closeOnEscapeKeyDown);
        return () =>
            document.removeEventListener('keydown', closeOnEscapeKeyDown);
    }, []);

    return (
        // <div className={`${classes.modalOverlay} ${show ? classes.show : 'z-30'} `}>
        //     <div className={`${classes.modal} border-border border bg-accent relative rounded-2xl`}>
        //         <div className={classes.title}>{title}</div>
        //         <div className={classes.content}>{content}</div>
        //         <button className={classes.button} onClick={closeModal}>
        //             ОK
        //         </button>
        //     </div>
        // </div>
        <Dialog open={show} onOpenChange={setShow}>
        <DialogContent className="sm:max-w-[425px] bg-accent/90 backdrop-filter backdrop-blur-xl border-border">
            <DialogHeader>
            <DialogTitle className='text-center'>{title}</DialogTitle>
            {content && <DialogDescription className='text-center mt-2'>{content}</DialogDescription>}
            </DialogHeader>
            <div className="flex justify-center">
            <Button className='w-1/2' onClick={closeModal}>OK</Button>
            </div>
        </DialogContent>
        </Dialog>

    );
}
