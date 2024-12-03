import { App } from '@slack/bolt';

export interface Plugin {
    (app: App): Promise<void>;
}

export interface StorageData {
    [key: string]: any;
}

export interface Storage {
    id: string;
    data: StorageData;
}

export interface Command {
    pattern: string;
    description: string;
}

export interface HelpSection {
    title: string;
    description: string;
    commands: Command[];
}

export interface HelpText {
    [key: string]: HelpSection;
} 