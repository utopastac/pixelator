import EditableText from '@/primitives/EditableText';
import styles from './DrawingTitleControl.module.css';

export interface DrawingTitleControlProps {
  title: string;
  onTitleChange: (next: string) => void;
}

/** Editable drawing name in the title bar. */
export default function DrawingTitleControl({ title, onTitleChange }: DrawingTitleControlProps) {
  return (
    <div className={styles.root}>
      <EditableText
        value={title}
        onChange={onTitleChange}
        size="sm"
        ariaLabel="Drawing name"
      />
    </div>
  );
}
