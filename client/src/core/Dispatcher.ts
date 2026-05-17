type EventCallback = () => void;

interface ScheduledEvent {
    callback: EventCallback;
    delay: number;
    repeat: number; // 0 for once, > 0 for cycle
    lastRun: number;
}

class Dispatcher {
    private static instance: Dispatcher;
    private eventList: EventCallback[] = [];
    private deferEventList: EventCallback[] = [];
    private scheduledEventList: ScheduledEvent[] = [];

    private constructor() {}

    public static getInstance(): Dispatcher {
        if (!Dispatcher.instance) {
            Dispatcher.instance = new Dispatcher();
        }
        return Dispatcher.instance;
    }

    addEvent(callback: EventCallback): void {
        this.eventList.push(callback);
    }

    deferEvent(callback: EventCallback): void {
        this.deferEventList.push(callback);
    }

    scheduleEvent(callback: EventCallback, delay: number): void {
        this.scheduledEventList.push({
            callback,
            delay,
            repeat: 0,
            lastRun: performance.now()
        });
    }

    cycleEvent(callback: EventCallback, delay: number): void {
        this.scheduledEventList.push({
            callback,
            delay,
            repeat: 1,
            lastRun: performance.now()
        });
    }

    poll(): void {
        // 1. Execute normal events
        const currentEvents = this.eventList;
        this.eventList = [];
        currentEvents.forEach(event => event());

        // 2. Execute scheduled events
        const now = performance.now();
        for (let i = 0; i < this.scheduledEventList.length; i++) {
            const event = this.scheduledEventList[i];
            if (now - event.lastRun >= event.delay) {
                event.callback();
                event.lastRun = now;
                if (event.repeat === 0) {
                    this.scheduledEventList.splice(i, 1);
                    i--;
                }
            }
        }

        // 3. Execute defer events
        const currentDeferEvents = this.deferEventList;
        this.deferEventList = [];
        currentDeferEvents.forEach(event => event());
    }
}

export const g_dispatcher = Dispatcher.getInstance();
